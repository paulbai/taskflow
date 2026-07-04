import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';

async function getPageWithAuth(pageId: string, userId: string) {
    const page = await prisma.page.findUnique({
        where: { id: pageId },
        include: {
            createdBy: { select: { id: true, name: true } },
            comments: {
                include: { user: { select: { id: true, name: true, avatar: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!page) return { error: 'Page not found', status: 404 as const };

    const membership = await getWorkspaceMembership(page.workspaceId, userId);
    if (!membership) return { error: 'Forbidden', status: 403 as const };

    if (page.isPrivate && page.createdById !== userId) {
        return { error: 'This page is private', status: 403 as const };
    }

    return { page, membership };
}

export async function GET(_req: Request, { params }: { params: { pageId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getPageWithAuth(params.pageId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.page);
    } catch (error) {
        console.error('GET /api/pages/[pageId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { pageId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getPageWithAuth(params.pageId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.title !== undefined) {
            if (typeof body.title !== 'string' || body.title.length > 300) {
                return NextResponse.json({ error: 'Title must be under 300 characters' }, { status: 400 });
            }
            updateData.title = body.title.trim() || 'Untitled';
        }
        if (body.content !== undefined) {
            const raw = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
            if (raw.length > 1_000_000) {
                return NextResponse.json({ error: 'Page content too large' }, { status: 400 });
            }
            try {
                JSON.parse(raw);
            } catch {
                return NextResponse.json({ error: 'Content must be valid JSON' }, { status: 400 });
            }
            updateData.content = raw;
        }
        if (body.iconEmoji !== undefined) {
            if (body.iconEmoji !== null && (typeof body.iconEmoji !== 'string' || body.iconEmoji.length > 10)) {
                return NextResponse.json({ error: 'Invalid icon' }, { status: 400 });
            }
            updateData.iconEmoji = body.iconEmoji;
        }
        if (body.coverUrl !== undefined) {
            if (body.coverUrl !== null && (typeof body.coverUrl !== 'string' || body.coverUrl.length > 1000)) {
                return NextResponse.json({ error: 'Invalid cover URL' }, { status: 400 });
            }
            updateData.coverUrl = body.coverUrl;
        }
        if (body.isPublic !== undefined) updateData.isPublic = Boolean(body.isPublic);
        if (body.isArchived !== undefined) updateData.isArchived = Boolean(body.isArchived);
        if (body.isFavorite !== undefined) updateData.isFavorite = Boolean(body.isFavorite);
        if (body.isPrivate !== undefined) updateData.isPrivate = Boolean(body.isPrivate);
        if (body.parentId !== undefined) {
            if (body.parentId !== null) {
                if (body.parentId === params.pageId) {
                    return NextResponse.json({ error: 'A page cannot be its own parent' }, { status: 400 });
                }
                const parent = await prisma.page.findUnique({
                    where: { id: body.parentId },
                    select: { workspaceId: true },
                });
                if (!parent || parent.workspaceId !== result.page.workspaceId) {
                    return NextResponse.json({ error: 'Invalid parent page' }, { status: 400 });
                }
            }
            updateData.parentId = body.parentId;
        }
        if (body.position !== undefined) {
            if (typeof body.position !== 'number') {
                return NextResponse.json({ error: 'position must be a number' }, { status: 400 });
            }
            updateData.position = body.position;
        }

        const updated = await prisma.page.update({
            where: { id: params.pageId },
            data: updateData,
            select: { id: true, title: true, iconEmoji: true, coverUrl: true, updatedAt: true, isFavorite: true, isArchived: true, isPrivate: true, parentId: true, position: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/pages/[pageId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { pageId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getPageWithAuth(params.pageId, userId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // Soft delete: archive the page
        await prisma.page.update({
            where: { id: params.pageId },
            data: { isArchived: true },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/pages/[pageId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
