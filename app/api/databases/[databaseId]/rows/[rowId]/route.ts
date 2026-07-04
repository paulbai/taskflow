import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, safeJsonParse } from '@/lib/office';

async function checkRowAccess(databaseId: string, rowId: string, userId: string) {
    const row = await prisma.databaseRow.findUnique({
        where: { id: rowId },
        include: { database: { select: { id: true, workspaceId: true } } },
    });
    if (!row || row.databaseId !== databaseId) return { error: 'Row not found', status: 404 as const };

    const membership = await getWorkspaceMembership(row.database.workspaceId, userId);
    if (!membership) return { error: 'Forbidden', status: 403 as const };

    return { row };
}

export async function PATCH(req: Request, { params }: { params: { databaseId: string; rowId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await checkRowAccess(params.databaseId, params.rowId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.data !== undefined) {
            if (body.data === null || typeof body.data !== 'object') {
                return NextResponse.json({ error: 'data must be an object' }, { status: 400 });
            }
            const raw = JSON.stringify(body.data);
            if (raw.length > 100_000) {
                return NextResponse.json({ error: 'Row data too large' }, { status: 400 });
            }
            updateData.data = raw;
        }
        if (body.position !== undefined) {
            if (typeof body.position !== 'number') {
                return NextResponse.json({ error: 'position must be a number' }, { status: 400 });
            }
            updateData.position = body.position;
        }

        const updated = await prisma.databaseRow.update({
            where: { id: params.rowId },
            data: updateData,
        });

        return NextResponse.json({
            id: updated.id,
            data: safeJsonParse(updated.data, {}),
            position: updated.position,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        });
    } catch (error) {
        console.error('PATCH /api/databases/[databaseId]/rows/[rowId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { databaseId: string; rowId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await checkRowAccess(params.databaseId, params.rowId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        await prisma.databaseRow.delete({ where: { id: params.rowId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/databases/[databaseId]/rows/[rowId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
