import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    const clientId = getClientId(req);
    const { success: allowed } = rateLimit(`join-ws:${clientId}`, { maxRequests: 5, windowMs: 60_000 });
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

    // Try workspace invite code first
    const workspace = await prisma.workspace.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
    });

    if (!workspace) {
        // Try board invite code
        const board = await prisma.board.findUnique({
            where: { inviteCode: inviteCode.trim().toUpperCase() },
            include: { workspace: true },
        });

        if (!board) {
            return NextResponse.json({ error: 'Invalid or expired invite code.' }, { status: 404 });
        }

        // Add to workspace
        const existing = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
        });

        if (!existing) {
            await prisma.workspaceMember.create({
                data: { workspaceId: board.workspaceId, userId, role: 'member' },
            });
        }

        return NextResponse.json({
            type: 'board',
            workspaceId: board.workspaceId,
            workspaceName: board.workspace.name,
            boardId: board.id,
            boardName: board.name,
            message: existing
                ? 'You already have access to this board.'
                : `You joined "${board.workspace.name}" and can now collaborate on "${board.name}".`,
        });
    }

    // Add to workspace
    const existing = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    });

    if (!existing) {
        await prisma.workspaceMember.create({
            data: { workspaceId: workspace.id, userId, role: 'member' },
        });
    }

    return NextResponse.json({
        type: 'workspace',
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        message: existing
            ? 'You already have access to this workspace.'
            : `You joined "${workspace.name}" successfully!`,
    });
}
