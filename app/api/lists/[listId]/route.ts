import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { listId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId } = params;

    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    if (list.ownerId !== userId) {
        return NextResponse.json({ error: 'Only the owner can update this list' }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
            return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
        }
        updateData.name = body.name.trim();
    }
    if (body.icon !== undefined) {
        if (typeof body.icon !== 'string' || body.icon.length > 10) {
            return NextResponse.json({ error: 'Invalid icon' }, { status: 400 });
        }
        updateData.icon = body.icon;
    }

    const updated = await prisma.list.update({
        where: { id: listId },
        data: updateData,
    });

    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { listId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId } = params;

    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    if (list.ownerId !== userId) {
        return NextResponse.json({ error: 'Only the owner can delete this list' }, { status: 403 });
    }

    await prisma.list.delete({ where: { id: listId } });
    return NextResponse.json({ ok: true });
}
