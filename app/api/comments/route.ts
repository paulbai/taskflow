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
        const pageId = searchParams.get('pageId');

        if (!pageId) {
            return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
        }

        const page = await prisma.page.findUnique({
            where: { id: pageId },
            select: { workspaceId: true },
        });
        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        const membership = await getWorkspaceMembership(page.workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const comments = await prisma.comment.findMany({
            where: { pageId },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
            take: 500,
        });

        return NextResponse.json(comments);
    } catch (error) {
        console.error('GET /api/comments error:', error);
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
        const { success: allowed } = await rateLimit(`comments:${clientId}`, { maxRequests: 30, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many comments. Please slow down.' }, { status: 429 });
        }

        const userId = (session.user as { id: string }).id;
        const userName = session.user.name || 'Someone';
        const { pageId, content, parentId } = await req.json();

        if (!pageId || typeof pageId !== 'string') {
            return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
        }
        if (!content?.trim() || typeof content !== 'string' || content.length > 5000) {
            return NextResponse.json({ error: 'Comment is required (max 5000 characters)' }, { status: 400 });
        }

        const page = await prisma.page.findUnique({
            where: { id: pageId },
            select: { workspaceId: true, title: true },
        });
        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        const membership = await getWorkspaceMembership(page.workspaceId, userId);
        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { pageId: true },
            });
            if (!parent || parent.pageId !== pageId) {
                return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 });
            }
        }

        const comment = await prisma.comment.create({
            data: {
                pageId,
                userId,
                parentId: parentId || null,
                content: content.trim(),
            },
            include: { user: { select: { id: true, name: true, avatar: true } } },
        });

        // Notify @mentioned workspace members
        const mentionMatches = content.match(/@([\w.-]+(?:\s[\w.-]+)?)/g) || [];
        if (mentionMatches.length > 0) {
            const workspace = await prisma.workspace.findUnique({
                where: { id: page.workspaceId },
                select: {
                    slug: true,
                    members: { include: { user: { select: { id: true, name: true } } } },
                },
            });
            if (workspace) {
                const notified = new Set<string>();
                for (const raw of mentionMatches) {
                    const mentionName = raw.slice(1).toLowerCase();
                    for (const member of workspace.members) {
                        const memberName = member.user.name.toLowerCase();
                        if (
                            member.user.id !== userId &&
                            !notified.has(member.user.id) &&
                            (memberName === mentionName || memberName.startsWith(mentionName.split(' ')[0]))
                        ) {
                            notified.add(member.user.id);
                            await prisma.notification.create({
                                data: {
                                    userId: member.user.id,
                                    type: 'mention',
                                    message: `${userName} mentioned you in "${page.title}"`,
                                    linkUrl: `/w/${workspace.slug}/page/${pageId}`,
                                },
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json(comment, { status: 201 });
    } catch (error) {
        console.error('POST /api/comments error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
