import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

async function verifyBoardAccess(boardId: string, userId: string) {
    const board = await prisma.board.findUnique({
        where: { id: boardId },
        include: { workspace: { include: { members: true } } },
    });
    if (!board) return null;
    const isMember = board.workspace.members.some(m => m.userId === userId);
    if (!isMember) return null;
    return board;
}

export async function GET(_req: Request, { params }: { params: { boardId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const board = await verifyBoardAccess(params.boardId, userId);
    if (!board) {
        return NextResponse.json({ error: 'Board not found or access denied' }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
        where: { boardId: params.boardId },
        include: {
            subtasks: true,
            createdBy: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 200,
    });

    const result = tasks.map(t => {
        let parsedTags: string[] = [];
        try { parsedTags = JSON.parse(t.tags); } catch { parsedTags = []; }
        let parsedLinks: { title?: string; url: string }[] = [];
        try { parsedLinks = JSON.parse(t.links); } catch { parsedLinks = []; }
        return {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            startDate: t.startDate,
            dueDate: t.dueDate,
            tags: parsedTags,
            links: parsedLinks,
            createdAt: t.createdAt.getTime(),
            subtasks: t.subtasks,
            createdBy: t.createdBy,
            assignee: t.assignee,
            assigneeId: t.assigneeId,
            inviteCode: t.inviteCode,
            boardId: t.boardId,
            listId: t.listId,
        };
    });

    return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { boardId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const board = await verifyBoardAccess(params.boardId, userId);
    if (!board) {
        return NextResponse.json({ error: 'Board not found or access denied' }, { status: 403 });
    }

    const { title, description, priority, startDate, dueDate, tags, assigneeName } = await req.json();

    if (!title?.trim() || typeof title !== 'string' || title.trim().length > 500) {
        return NextResponse.json({ error: 'Title is required (max 500 characters)' }, { status: 400 });
    }

    // Resolve assignee by name if provided
    let assigneeId: string | null = null;
    if (assigneeName?.trim()) {
        // Find a workspace member by name (case-insensitive partial match)
        const members = board.workspace.members;
        const matchedMember = await prisma.user.findFirst({
            where: {
                id: { in: members.map(m => m.userId) },
                name: { contains: assigneeName.trim() },
            },
        });
        if (matchedMember) {
            assigneeId = matchedMember.id;
        }
    }

    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const task = await prisma.task.create({
        data: {
            title: title.trim(),
            description: description?.trim() || null,
            priority: priority || 'none',
            startDate: startDate || null,
            dueDate: dueDate || null,
            tags: JSON.stringify(tags || []),
            boardId: params.boardId,
            createdById: userId,
            assigneeId,
            inviteCode,
            status: 'todo',
        },
        include: {
            subtasks: true,
            createdBy: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
        },
    });

    let parsedTags: string[] = [];
    try { parsedTags = JSON.parse(task.tags); } catch { parsedTags = []; }

    return NextResponse.json({
        ...task,
        tags: parsedTags,
        createdAt: task.createdAt.getTime(),
    }, { status: 201 });
}
