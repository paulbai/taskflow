import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, validateDbSchema, VALID_DB_VIEWS } from '@/lib/office';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
        }

        const databases = await prisma.database.findMany({
            where: { workspaceId },
            select: {
                id: true,
                title: true,
                iconEmoji: true,
                defaultView: true,
                isTaskDb: true,
                updatedAt: true,
                _count: { select: { rows: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 100,
        });

        return NextResponse.json(databases.map(db => ({
            id: db.id,
            title: db.title,
            iconEmoji: db.iconEmoji,
            defaultView: db.defaultView,
            isTaskDb: db.isTaskDb,
            updatedAt: db.updatedAt,
            rowCount: db._count.rows,
        })));
    } catch (error) {
        console.error('GET /api/databases error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`db-create:${clientId}`, { maxRequests: 20, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId, title, iconEmoji, schema, defaultView, isTaskDb } = await req.json();

        if (!workspaceId || typeof workspaceId !== 'string') {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
        }

        if (!title?.trim() || typeof title !== 'string' || title.trim().length > 200) {
            return NextResponse.json({ error: 'Title is required (max 200 characters)' }, { status: 400 });
        }

        const schemaError = validateDbSchema(schema);
        if (schemaError) {
            return NextResponse.json({ error: schemaError }, { status: 400 });
        }

        if (defaultView !== undefined && !VALID_DB_VIEWS.includes(defaultView)) {
            return NextResponse.json({ error: 'Invalid default view' }, { status: 400 });
        }

        const database = await prisma.database.create({
            data: {
                workspaceId,
                title: title.trim(),
                iconEmoji: iconEmoji || null,
                schema: JSON.stringify(schema),
                defaultView: defaultView || 'table',
                isTaskDb: Boolean(isTaskDb),
            },
        });

        return NextResponse.json({
            ...database,
            schema: JSON.parse(database.schema),
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/databases error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
