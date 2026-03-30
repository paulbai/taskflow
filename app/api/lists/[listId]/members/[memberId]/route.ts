import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: { listId: string; memberId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId, memberId } = params;

    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Users can remove themselves (leave), or owners can remove anyone
    const isOwner = list.ownerId === userId;
    const isSelf = memberId === userId;

    if (!isOwner && !isSelf) {
        return NextResponse.json({ error: 'Only the owner can remove members' }, { status: 403 });
    }

    // Owner cannot remove themselves — they must delete the list instead
    if (isOwner && isSelf) {
        return NextResponse.json({ error: 'Owner cannot leave. Delete the list instead.' }, { status: 400 });
    }

    const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: memberId } },
    });

    if (!membership) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await prisma.listMember.delete({
        where: { listId_userId: { listId, userId: memberId } },
    });

    return NextResponse.json({ ok: true });
}
