import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, safeJsonParse } from '@/lib/office';
import { rateLimit, getClientId } from '@/lib/rate-limit';

async function checkAccess(databaseId: string, userId: string) {
    const database = await prisma.database.findUnique({
        where: { id: databaseId },
        select: { id: true, workspaceId: true },
    });
    if (!database) return { error: 'Database not found', status: 404 as const };

    const membership = await getWorkspaceMembership(database.workspaceId, userId);
    if (!membership) return { error: 'Forbidden', status: 403 as const };

    return { database };
}

export async function GET(_req: Request, { params }: { params: { databaseId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await checkAccess(params.databaseId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const rows = await prisma.databaseRow.findMany({
            where: { databaseId: params.databaseId },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            take: 1000,
        });

        return NextResponse.json(rows.map(row => ({
            id: row.id,
            data: safeJsonParse(row.data, {}),
            position: row.position,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })));
    } catch (error) {
        console.error('GET /api/databases/[databaseId]/rows error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { databaseId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`row-create:${clientId}`, { maxRequests: 60, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await checkAccess(params.databaseId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const { data, position } = await req.json();

        if (data === undefined || data === null || typeof data !== 'object') {
            return NextResponse.json({ error: 'data object is required' }, { status: 400 });
        }

        const raw = JSON.stringify(data);
        if (raw.length > 100_000) {
            return NextResponse.json({ error: 'Row data too large' }, { status: 400 });
        }

        const row = await prisma.databaseRow.create({
            data: {
                databaseId: params.databaseId,
                data: raw,
                position: typeof position === 'number' ? position : 0,
            },
        });

        return NextResponse.json({
            id: row.id,
            data: safeJsonParse(row.data, {}),
            position: row.position,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/databases/[databaseId]/rows error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
