import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { boardId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const board = await prisma.board.findUnique({
        where: { id: params.boardId },
        include: {
            workspace: {
                include: {
                    members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
                },
            },
        },
    });

    if (!board) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const isMember = board.workspace.members.some(m => m.userId === userId);
    if (!isMember) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
        id: board.id,
        name: board.name,
        description: board.description,
        workspaceId: board.workspaceId,
        workspaceName: board.workspace.name,
        inviteCode: board.inviteCode,
        createdAt: board.createdAt.toISOString(),
        members: board.workspace.members.map(m => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            avatar: m.user.avatar,
        })),
    });
}
