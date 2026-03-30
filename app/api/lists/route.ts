import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const lists = await prisma.list.findMany({
        where: {
            members: { some: { userId } },
        },
        include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    const result = lists.map(list => ({
        id: list.id,
        name: list.name,
        icon: list.icon,
        ownerId: list.ownerId,
        isShared: list.members.length > 1,
        memberCount: list.members.length,
        taskCount: list._count.tasks,
        inviteCode: list.ownerId === userId ? list.inviteCode : undefined,
        members: list.members.map(m => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
        })),
    }));

    return NextResponse.json(result);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { name, icon } = await req.json();

    if (!name?.trim() || typeof name !== 'string' || name.trim().length > 100) {
        return NextResponse.json({ error: 'Name is required (max 100 characters)' }, { status: 400 });
    }

    if (icon !== undefined && (typeof icon !== 'string' || icon.length > 10)) {
        return NextResponse.json({ error: 'Invalid icon' }, { status: 400 });
    }

    const inviteCode = crypto.randomBytes(6).toString('hex');

    const list = await prisma.list.create({
        data: {
            name: name.trim(),
            icon: icon || '📋',
            ownerId: userId,
            inviteCode,
            members: {
                create: { userId, role: 'owner' },
            },
        },
    });

    return NextResponse.json(list, { status: 201 });
}
