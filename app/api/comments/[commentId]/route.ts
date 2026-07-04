import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';

async function getCommentWithAuth(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { page: { select: { workspaceId: true } } },
    });
    if (!comment) return { error: 'Comment not found', status: 404 as const };

    const membership = await getWorkspaceMembership(comment.page.workspaceId, userId);
    if (!membership) return { error: 'Forbidden', status: 403 as const };

    return { comment };
}

export async function PATCH(req: Request, { params }: { params: { commentId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getCommentWithAuth(params.commentId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.resolved !== undefined) {
            if (typeof body.resolved !== 'boolean') {
                return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 });
            }
            updateData.resolved = body.resolved;
        }

        const updated = await prisma.comment.update({
            where: { id: params.commentId },
            data: updateData,
            include: { user: { select: { id: true, name: true, avatar: true } } },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/comments/[commentId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { commentId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const result = await getCommentWithAuth(params.commentId, userId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // Only the author can delete their own comment
        if (result.comment.userId !== userId) {
            return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
        }

        await prisma.comment.delete({ where: { id: params.commentId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/comments/[commentId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
