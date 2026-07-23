import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/office';
import type { DbColumn, DbSelectOption } from '@/lib/office-types';

export const dynamic = 'force-dynamic';

/** Status buckets the classic view understands. */
export type SimpleStatus = 'todo' | 'in_progress' | 'done';

/** Map a workspace status option label onto one of the three simple buckets. */
function bucketOf(label: string): SimpleStatus {
    const l = label.toLowerCase();
    if (/(done|closed|complete|shipped)/.test(l)) return 'done';
    if (/(progress|ongoing|doing|active|review|pending)/.test(l)) return 'in_progress';
    return 'todo'; // to do, not started, on hold, blocked…
}

/** Does this assignee value refer to the signed-in user? */
function isMine(value: unknown, userId: string, names: string[]): boolean {
    if (typeof value !== 'string' || !value.trim()) return false;
    if (value === userId) return true; // person column stores the userId
    const v = value.toLowerCase();
    return names.some(n => n.length > 1 && v.includes(n));
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const fullName = (session.user.name || '').toLowerCase().trim();
        const emailLocal = (session.user.email || '').split('@')[0].toLowerCase();
        const names = Array.from(
            new Set([fullName, fullName.split(' ')[0], emailLocal].filter(Boolean)),
        );

        // Every workspace this user belongs to, with its task databases
        const memberships = await prisma.workspaceMember.findMany({
            where: { userId },
            select: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        iconEmoji: true,
                        databases: {
                            where: { isTaskDb: true },
                            select: {
                                id: true,
                                title: true,
                                schema: true,
                                rows: {
                                    select: { id: true, data: true, updatedAt: true },
                                    take: 500,
                                },
                            },
                        },
                    },
                },
            },
        });

        type MyTask = {
            rowId: string;
            databaseId: string;
            workspaceId: string;
            workspaceName: string;
            workspaceSlug: string | null;
            workspaceIcon: string;
            title: string;
            statusLabel: string;
            statusColor: string;
            bucket: SimpleStatus;
            statusColumnId: string;
            statusOptions: DbSelectOption[];
            dueDate: string | null;
            updatedAt: string;
        };

        const tasks: MyTask[] = [];

        for (const m of memberships) {
            const ws = m.workspace;
            for (const db of ws.databases) {
                const schema = safeJsonParse<DbColumn[]>(db.schema, []);
                const titleCol = schema.find(c => c.type === 'text');
                const statusCol = schema.find(
                    c => c.type === 'select' && /status/i.test(c.name),
                ) || schema.find(c => c.type === 'select');
                const assigneeCol = schema.find(c => c.type === 'person')
                    || schema.find(c => /assign|owner|who/i.test(c.name));
                const dateCol = schema.find(c => c.type === 'date');
                if (!titleCol || !assigneeCol) continue;

                for (const row of db.rows) {
                    const data = safeJsonParse<Record<string, unknown>>(row.data, {});
                    if (!isMine(data[assigneeCol.id], userId, names)) continue;

                    const option = statusCol?.options?.find(o => o.id === data[statusCol.id]);
                    const statusLabel = option?.label || 'To Do';

                    tasks.push({
                        rowId: row.id,
                        databaseId: db.id,
                        workspaceId: ws.id,
                        workspaceName: ws.name,
                        workspaceSlug: ws.slug,
                        workspaceIcon: ws.iconEmoji,
                        title: String(data[titleCol.id] || 'Untitled'),
                        statusLabel,
                        statusColor: option?.color || 'orange',
                        bucket: bucketOf(statusLabel),
                        statusColumnId: statusCol?.id || '',
                        statusOptions: statusCol?.options || [],
                        dueDate: dateCol ? ((data[dateCol.id] as string) || null) : null,
                        updatedAt: row.updatedAt.toISOString(),
                    });
                }
            }
        }

        tasks.sort((a, b) => {
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return a.title.localeCompare(b.title);
        });

        return NextResponse.json({ tasks });
    } catch (error) {
        console.error('GET /api/my-tasks error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

/** Move one of my workspace tasks to a different status. */
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { rowId, statusOptionId } = await req.json();

        if (!rowId || typeof rowId !== 'string' || !statusOptionId || typeof statusOptionId !== 'string') {
            return NextResponse.json({ error: 'rowId and statusOptionId are required' }, { status: 400 });
        }

        const row = await prisma.databaseRow.findUnique({
            where: { id: rowId },
            include: { database: { select: { id: true, schema: true, workspaceId: true } } },
        });
        if (!row) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: row.database.workspaceId, userId } },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const schema = safeJsonParse<DbColumn[]>(row.database.schema, []);
        const statusCol = schema.find(c => c.type === 'select' && /status/i.test(c.name))
            || schema.find(c => c.type === 'select');
        if (!statusCol) {
            return NextResponse.json({ error: 'This board has no status column' }, { status: 400 });
        }
        if (!statusCol.options?.some(o => o.id === statusOptionId)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const data = safeJsonParse<Record<string, unknown>>(row.data, {});
        data[statusCol.id] = statusOptionId;

        await prisma.databaseRow.update({
            where: { id: rowId },
            data: { data: JSON.stringify(data) },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('PATCH /api/my-tasks error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
