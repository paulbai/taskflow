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

    const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId } },
    });
    if (!membership) {
        return NextResponse.json({ error: 'Not a member of this list' }, { status: 403 });
    }

    const { taskIds } = await req.json();

    if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 500) {
        return NextResponse.json({ error: 'taskIds must be a non-empty array (max 500)' }, { status: 400 });
    }

    // Validate all strings
    if (!taskIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
        return NextResponse.json({ error: 'All taskIds must be non-empty strings' }, { status: 400 });
    }

    // SECURITY: Verify all task IDs belong to this list to prevent cross-list IDOR
    const tasks = await prisma.task.findMany({
        where: { id: { in: taskIds }, listId },
        select: { id: true },
    });

    if (tasks.length !== taskIds.length) {
        return NextResponse.json({ error: 'One or more task IDs do not belong to this list' }, { status: 400 });
    }

    // Update sortOrder for each task in the provided order
    await prisma.$transaction(
        taskIds.map((id: string, index: number) =>
            prisma.task.update({
                where: { id },
                data: { sortOrder: index },
            })
        )
    );

    return NextResponse.json({ ok: true });
}
