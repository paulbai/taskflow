import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request, { params }: { params: { workspaceId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { workspaceId } = params;

    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
        return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const { name, description } = await req.json();

    if (!name?.trim() || typeof name !== 'string' || name.trim().length > 100) {
        return NextResponse.json({ error: 'Board name is required (max 100 chars)' }, { status: 400 });
    }

    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const board = await prisma.board.create({
        data: {
            name: name.trim(),
            description: description?.trim() || null,
            workspaceId,
            createdById: userId,
            inviteCode,
        },
    });

    return NextResponse.json({
        id: board.id,
        name: board.name,
        description: board.description,
        workspaceId: board.workspaceId,
        inviteCode: board.inviteCode,
        taskCount: 0,
        createdAt: board.createdAt.toISOString(),
    }, { status: 201 });
}
