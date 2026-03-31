import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { taskId } = params;

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            list: { include: { members: true } },
            board: { include: { workspace: { include: { members: true } } } },
        },
    });

    if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check access via list OR board membership
    const isListMember = task.list?.members?.some(m => m.userId === userId) || false;
    const isBoardMember = task.board?.workspace?.members?.some(m => m.userId === userId) || false;
    if (!isListMember && !isBoardMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    // Input validation with length limits
    if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 500) {
            return NextResponse.json({ error: 'Title must be 1-500 characters' }, { status: 400 });
        }
        updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
        if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 5000)) {
            return NextResponse.json({ error: 'Description must be under 5000 characters' }, { status: 400 });
        }
        updateData.description = body.description || null;
    }
    if (body.status !== undefined) {
        const validStatuses = ['todo', 'in_progress', 'done'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json({ error: 'Status must be todo, in_progress, or done' }, { status: 400 });
        }
        updateData.status = body.status;
    }
    // Backward compat: isCompleted maps to status
    if (body.isCompleted !== undefined) {
        updateData.status = body.isCompleted ? 'done' : 'todo';
    }
    if (body.startDate !== undefined) {
        if (body.startDate !== null && (typeof body.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate))) {
            return NextResponse.json({ error: 'startDate must be YYYY-MM-DD format or null' }, { status: 400 });
        }
        updateData.startDate = body.startDate || null;
    }
    if (body.priority !== undefined) {
        const validPriorities = ['none', 'low', 'medium', 'high'];
        if (!validPriorities.includes(body.priority)) {
            return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 });
        }
        updateData.priority = body.priority;
    }
    if (body.dueDate !== undefined) {
        if (body.dueDate !== null && (typeof body.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) {
            return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD format or null' }, { status: 400 });
        }
        updateData.dueDate = body.dueDate || null;
    }
    if (body.tags !== undefined) {
        if (!Array.isArray(body.tags) || body.tags.length > 20 || !body.tags.every((t: unknown) => typeof t === 'string' && (t as string).length <= 50)) {
            return NextResponse.json({ error: 'Tags must be an array of up to 20 strings (max 50 chars each)' }, { status: 400 });
        }
        updateData.tags = JSON.stringify(body.tags);
    }
    if (body.links !== undefined) {
        if (!Array.isArray(body.links) || body.links.length > 20) {
            return NextResponse.json({ error: 'Links must be an array of up to 20 items' }, { status: 400 });
        }
        for (const link of body.links) {
            if (!link.url || typeof link.url !== 'string' || link.url.length > 2000) {
                return NextResponse.json({ error: 'Each link must have a valid url (max 2000 chars)' }, { status: 400 });
            }
        }
        updateData.links = JSON.stringify(body.links);
    }
    if (body.assigneeId !== undefined) {
        // SECURITY: Verify assignee is a member of the list or workspace
        if (body.assigneeId) {
            const isListAssignee = task.list?.members?.some(m => m.userId === body.assigneeId) || false;
            const isWorkspaceAssignee = task.board?.workspace?.members?.some(m => m.userId === body.assigneeId) || false;
            if (!isListAssignee && !isWorkspaceAssignee) {
                return NextResponse.json({ error: 'Assignee must be a member' }, { status: 403 });
            }
        }
        updateData.assigneeId = body.assigneeId || null;
    }

    const updated = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
            subtasks: true,
            createdBy: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
        },
    });

    let parsedTags: string[] = [];
    try { parsedTags = JSON.parse(updated.tags); } catch { parsedTags = []; }
    let parsedLinks: { title?: string; url: string }[] = [];
    try { parsedLinks = JSON.parse(updated.links); } catch { parsedLinks = []; }

    return NextResponse.json({
        ...updated,
        tags: parsedTags,
        links: parsedLinks,
        createdAt: updated.createdAt.getTime(),
    });
}

export async function DELETE(_req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { taskId } = params;

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            list: { include: { members: true } },
            board: { include: { workspace: { include: { members: true } } } },
        },
    });

    if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isListMember = task.list?.members?.some(m => m.userId === userId) || false;
    const isBoardMember = task.board?.workspace?.members?.some(m => m.userId === userId) || false;
    if (!isListMember && !isBoardMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.task.delete({ where: { id: taskId } });
    return NextResponse.json({ ok: true });
}
