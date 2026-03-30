import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getSubtaskWithAuth(subtaskId: string, userId: string) {
    const subtask = await prisma.subtask.findUnique({
        where: { id: subtaskId },
        include: { task: { include: { list: { include: { members: true } } } } },
    });

    if (!subtask) return { error: 'Subtask not found', status: 404 };

    const isMember = subtask.task.list.members.some(m => m.userId === userId);
    if (!isMember) return { error: 'Forbidden', status: 403 };

    return { subtask };
}

export async function PATCH(req: Request, { params }: { params: { subtaskId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const result = await getSubtaskWithAuth(params.subtaskId, userId);

    if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 500) {
            return NextResponse.json({ error: 'Title must be 1-500 characters' }, { status: 400 });
        }
        updateData.title = body.title.trim();
    }
    if (body.isCompleted !== undefined) {
        if (typeof body.isCompleted !== 'boolean') {
            return NextResponse.json({ error: 'isCompleted must be a boolean' }, { status: 400 });
        }
        updateData.isCompleted = body.isCompleted;
    }

    const updated = await prisma.subtask.update({
        where: { id: params.subtaskId },
        data: updateData,
    });

    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { subtaskId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const result = await getSubtaskWithAuth(params.subtaskId, userId);

    if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await prisma.subtask.delete({ where: { id: params.subtaskId } });
    return NextResponse.json({ ok: true });
}
