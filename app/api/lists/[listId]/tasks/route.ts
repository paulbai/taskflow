import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(_req: Request, { params }: { params: { listId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { listId } = params;

    // Verify membership
    const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId } },
    });
    if (!membership) {
        return NextResponse.json({ error: 'Not a member of this list' }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
        where: { listId },
        include: {
            subtasks: true,
            createdBy: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
        },
        orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    });

    const result = tasks.map(t => {
        let parsedTags: string[] = [];
        try { parsedTags = JSON.parse(t.tags); } catch { parsedTags = []; }
        return {
            id: t.id,
            title: t.title,
            description: t.description,
            isCompleted: t.isCompleted,
            priority: t.priority,
            dueDate: t.dueDate,
            tags: parsedTags,
            createdAt: t.createdAt.getTime(),
            subtasks: t.subtasks,
            createdBy: t.createdBy,
            assignee: t.assignee,
            assigneeId: t.assigneeId,
            inviteCode: t.inviteCode,
        };
    });

    return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { listId: string } }) {
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

    const { title, description, priority, dueDate, tags } = await req.json();

    if (!title?.trim() || typeof title !== 'string' || title.trim().length > 500) {
        return NextResponse.json({ error: 'Title is required (max 500 characters)' }, { status: 400 });
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 5000)) {
        return NextResponse.json({ error: 'Description must be under 5000 characters' }, { status: 400 });
    }
    if (priority !== undefined) {
        const validPriorities = ['none', 'low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) {
            return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 });
        }
    }
    if (dueDate !== undefined && dueDate !== null && (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
        return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD or null' }, { status: 400 });
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 20 || !tags.every((t: unknown) => typeof t === 'string' && (t as string).length <= 50))) {
        return NextResponse.json({ error: 'Tags must be an array of up to 20 strings (max 50 chars)' }, { status: 400 });
    }

    // Generate a cryptographically strong invite code (16 bytes = 128-bit)
    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const task = await prisma.task.create({
        data: {
            title: title.trim(),
            description: description || null,
            priority: priority || 'none',
            dueDate: dueDate || null,
            tags: JSON.stringify(tags || []),
            listId,
            createdById: userId,
            inviteCode,
        },
        include: {
            subtasks: true,
            createdBy: { select: { id: true, name: true } },
        },
    });

    return NextResponse.json({
        ...task,
        tags: JSON.parse(task.tags),
        createdAt: task.createdAt.getTime(),
    }, { status: 201 });
}
