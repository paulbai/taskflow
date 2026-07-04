import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, safeJsonParse } from '@/lib/office';
import type { DbColumn } from '@/lib/office-types';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');
        const q = (searchParams.get('q') || '').trim().toLowerCase();

        if (!workspaceId || !q || q.length < 2 || q.length > 100) {
            return NextResponse.json({ rows: [] });
        }

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
        }

        // Fetch this workspace's databases with their rows, then match text
        // columns in app code (row data is a JSON string in SQLite).
        const databases = await prisma.database.findMany({
            where: { workspaceId },
            select: {
                id: true,
                isTaskDb: true,
                schema: true,
                rows: {
                    select: { id: true, data: true },
                    take: 500,
                    orderBy: { updatedAt: 'desc' },
                },
            },
            take: 50,
        });

        const rows: { id: string; databaseId: string; title: string; isTaskDb: boolean }[] = [];

        for (const db of databases) {
            const schema = safeJsonParse<DbColumn[]>(db.schema, []);
            const textCols = schema.filter(c => c.type === 'text' || c.type === 'url');
            const titleCol = textCols[0];
            if (!titleCol) continue;

            for (const row of db.rows) {
                const data = safeJsonParse<Record<string, unknown>>(row.data, {});
                const matched = textCols.some(col => {
                    const value = data[col.id];
                    return typeof value === 'string' && value.toLowerCase().includes(q);
                });
                if (matched) {
                    const title = String(data[titleCol.id] || 'Untitled row');
                    rows.push({ id: row.id, databaseId: db.id, title, isTaskDb: db.isTaskDb });
                    if (rows.length >= 20) break;
                }
            }
            if (rows.length >= 20) break;
        }

        return NextResponse.json({ rows });
    } catch (error) {
        console.error('GET /api/search error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
