import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
            return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
        }
        updateData.name = body.name.trim();
    }
    if (body.avatar !== undefined) {
        if (body.avatar !== null && (typeof body.avatar !== 'string' || body.avatar.length > 500)) {
            return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
        }
        updateData.avatar = body.avatar || null;
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });

    return NextResponse.json(updated);
}
