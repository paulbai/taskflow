import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';
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

        const pages = await prisma.page.findMany({
            where: {
                workspaceId,
                isArchived: false,
                OR: [{ isPrivate: false }, { createdById: userId }],
            },
            select: {
                id: true,
                parentId: true,
                title: true,
                iconEmoji: true,
                isFavorite: true,
                isPrivate: true,
                position: true,
                createdById: true,
                updatedAt: true,
            },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            take: 500,
        });

        return NextResponse.json(pages);
    } catch (error) {
        console.error('GET /api/pages error:', error);
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
        const { success: allowed } = await rateLimit(`pages-create:${clientId}`, { maxRequests: 30, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId, parentId, title, iconEmoji, isPrivate } = await req.json();

        if (!workspaceId || typeof workspaceId !== 'string') {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
        }

        if (title !== undefined && (typeof title !== 'string' || title.length > 300)) {
            return NextResponse.json({ error: 'Title must be under 300 characters' }, { status: 400 });
        }

        if (parentId) {
            const parent = await prisma.page.findUnique({ where: { id: parentId }, select: { workspaceId: true } });
            if (!parent || parent.workspaceId !== workspaceId) {
                return NextResponse.json({ error: 'Invalid parent page' }, { status: 400 });
            }
        }

        const page = await prisma.page.create({
            data: {
                workspaceId,
                parentId: parentId || null,
                title: title?.trim() || 'Untitled',
                iconEmoji: iconEmoji || null,
                isPrivate: Boolean(isPrivate),
                createdById: userId,
                content: JSON.stringify([{ id: crypto.randomUUID(), type: 'paragraph', content: '', props: {} }]),
            },
        });

        return NextResponse.json(page, { status: 201 });
    } catch (error) {
        console.error('POST /api/pages error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
