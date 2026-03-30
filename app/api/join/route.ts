import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    // Rate limit: 5 attempts per minute per IP
    const clientId = getClientId(req);
    const { success: allowed } = rateLimit(`join:${clientId}`, { maxRequests: 5, windowMs: 60_000 });
    if (!allowed) {
        return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { inviteCode } = await req.json();

    if (!inviteCode) {
        return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const list = await prisma.list.findUnique({ where: { inviteCode } });

    if (!list) {
        return NextResponse.json({ error: 'Invalid or expired invite code.' }, { status: 404 });
    }

    const existing = await prisma.listMember.findUnique({
        where: { listId_userId: { listId: list.id, userId } },
    });

    if (existing) {
        return NextResponse.json({ listId: list.id, message: 'Already a member' });
    }

    await prisma.listMember.create({
        data: { listId: list.id, userId, role: 'member' },
    });

    return NextResponse.json({ listId: list.id, message: 'Joined successfully' }, { status: 201 });
}
