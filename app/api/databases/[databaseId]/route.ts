import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, validateDbSchema, VALID_DB_VIEWS, safeJsonParse } from '@/lib/office';

async function getDatabaseWithAuth(databaseId: string, userId: string) {
    const database = await prisma.database.findUnique({
        where: { id: databaseId },
    });

    if (!database) return { error: 'Database not found', status: 404 as const };

    const membership = await getWorkspaceMembership(database.workspaceId, userId);
    if (!membership) return { error: 'Forbidden', status: 403 as const };

    return { database, membership };
}

export async function GET(_req: Request, { params }: { params: { databaseId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getDatabaseWithAuth(params.databaseId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            ...result.database,
            schema: safeJsonParse(result.database.schema, []),
        });
    } catch (error) {
        console.error('GET /api/databases/[databaseId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { databaseId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getDatabaseWithAuth(params.databaseId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.title !== undefined) {
            if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
                return NextResponse.json({ error: 'Title must be 1-200 characters' }, { status: 400 });
            }
            updateData.title = body.title.trim();
        }
        if (body.iconEmoji !== undefined) {
            if (body.iconEmoji !== null && (typeof body.iconEmoji !== 'string' || body.iconEmoji.length > 10)) {
                return NextResponse.json({ error: 'Invalid icon' }, { status: 400 });
            }
            updateData.iconEmoji = body.iconEmoji;
        }
        if (body.schema !== undefined) {
            const schemaError = validateDbSchema(body.schema);
            if (schemaError) {
                return NextResponse.json({ error: schemaError }, { status: 400 });
            }
            updateData.schema = JSON.stringify(body.schema);
        }
        if (body.defaultView !== undefined) {
            if (!VALID_DB_VIEWS.includes(body.defaultView)) {
                return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
            }
            updateData.defaultView = body.defaultView;
        }

        const updated = await prisma.database.update({
            where: { id: params.databaseId },
            data: updateData,
        });

        return NextResponse.json({
            ...updated,
            schema: safeJsonParse(updated.schema, []),
        });
    } catch (error) {
        console.error('PATCH /api/databases/[databaseId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { databaseId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getDatabaseWithAuth(params.databaseId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        await prisma.database.delete({ where: { id: params.databaseId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/databases/[databaseId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
