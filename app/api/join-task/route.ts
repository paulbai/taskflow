import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    // Rate limit: 5 attempts per minute per IP
    const clientId = getClientId(req);
    const { success: allowed } = rateLimit(`join-task:${clientId}`, { maxRequests: 5, windowMs: 60_000 });
    if (!allowed) {
        return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { inviteCode } = await req.json();

    if (!inviteCode?.trim()) {
        return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Find the task by invite code
    const task = await prisma.task.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
        include: {
            list: true,
            board: { include: { workspace: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    if (!task) {
        return NextResponse.json({ error: 'Invalid or expired invite code.' }, { status: 404 });
    }

    // Board-based task: add user to the workspace
    if (task.boardId && task.board?.workspace) {
        const ws = task.board.workspace;
        const existingWsMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: ws.id, userId } },
        });
        if (!existingWsMember) {
            await prisma.workspaceMember.create({
                data: { workspaceId: ws.id, userId, role: 'member' },
            });
        }
        return NextResponse.json({
            taskId: task.id,
            taskTitle: task.title,
            boardId: task.boardId,
            workspaceName: ws.name,
            createdBy: task.createdBy,
            message: existingWsMember
                ? 'You already have access to this task.'
                : `You joined workspace "${ws.name}" and can now collaborate on "${task.title}".`,
        }, { status: 200 });
    }

    // List-based task: add user to the list
    if (task.listId && task.list) {
        const existingMember = await prisma.listMember.findUnique({
            where: { listId_userId: { listId: task.listId, userId } },
        });
        if (!existingMember) {
            await prisma.listMember.create({
                data: { listId: task.listId, userId, role: 'member' },
            });
        }
        return NextResponse.json({
            taskId: task.id,
            taskTitle: task.title,
            listId: task.listId,
            listName: task.list.name,
            createdBy: task.createdBy,
            message: existingMember
                ? 'You already have access to this task.'
                : `You joined "${task.list.name}" and can now collaborate on "${task.title}".`,
        }, { status: 200 });
    }

    return NextResponse.json({ error: 'Task has no associated list or board.' }, { status: 400 });
}
