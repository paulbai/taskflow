import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { taskId } = params;

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { list: { include: { members: true } } },
    });

    if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isMember = task.list.members.some(m => m.userId === userId);
    if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title } = await req.json();

    if (!title?.trim() || typeof title !== 'string' || title.trim().length > 500) {
        return NextResponse.json({ error: 'Title is required (max 500 characters)' }, { status: 400 });
    }

    const subtask = await prisma.subtask.create({
        data: {
            title: title.trim(),
            taskId,
        },
    });

    return NextResponse.json(subtask, { status: 201 });
}
