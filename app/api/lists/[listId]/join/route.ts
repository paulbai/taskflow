import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { listId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId } = params;
    const { inviteCode } = await req.json();

    const list = await prisma.list.findUnique({ where: { id: listId } });

    if (!list || list.inviteCode !== inviteCode) {
        return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    const existing = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId } },
    });

    if (existing) {
        return NextResponse.json({ message: 'Already a member' });
    }

    await prisma.listMember.create({
        data: { listId, userId, role: 'member' },
    });

    return NextResponse.json({ message: 'Joined successfully' }, { status: 201 });
}
