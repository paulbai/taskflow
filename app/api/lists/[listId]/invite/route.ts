import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(_req: Request, { params }: { params: { listId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId } = params;

    const list = await prisma.list.findUnique({ where: { id: listId } });

    if (!list || list.ownerId !== userId) {
        return NextResponse.json({ error: 'Only the owner can generate invite links' }, { status: 403 });
    }

    const inviteCode = crypto.randomBytes(6).toString('hex');

    await prisma.list.update({
        where: { id: listId },
        data: { inviteCode },
    });

    return NextResponse.json({ inviteCode });
}
