import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/office';
import type { DbColumn, DbSelectOption } from '@/lib/office-types';

export const dynamic = 'force-dynamic';

/**
 * Compact list of the workspaces the signed-in user belongs to, with the
 * task board of each — used by the simple classic view so a workspace is
 * always one tap away.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;

        const memberships = await prisma.workspaceMember.findMany({
            where: { userId },
            select: {
                role: true,
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        iconEmoji: true,
                        ownerId: true,
                        _count: { select: { members: true } },
                        databases: {
                            where: { isTaskDb: true },
                            select: {
                                id: true,
                                schema: true,
                                _count: { select: { rows: true } },
                            },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
        });

        const workspaces = memberships.map(m => {
            const ws = m.workspace;
            const taskDb = ws.databases[0] || null;
            const schema = taskDb ? safeJsonParse<DbColumn[]>(taskDb.schema, []) : [];
            const statusCol = schema.find(c => c.type === 'select' && /status/i.test(c.name))
                || schema.find(c => c.type === 'select');

            return {
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                iconEmoji: ws.iconEmoji,
                isOwner: ws.ownerId === userId,
                myRole: m.role,
                memberCount: ws._count.members,
                taskDatabaseId: taskDb?.id || null,
                taskCount: taskDb?._count.rows || 0,
                statusOptions: (statusCol?.options || []) as DbSelectOption[],
            };
        });

        return NextResponse.json({ workspaces });
    } catch (error) {
        console.error('GET /api/my-workspaces error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
