import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request, { params }: { params: { workspaceId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`ws-invite:${clientId}`, { maxRequests: 10, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many invites. Please slow down.' }, { status: 429 });
        }

        const userId = (session.user as { id: string }).id;
        const userName = session.user.name || 'Someone';
        const { workspaceId } = params;

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return NextResponse.json({ error: 'Only owners and admins can invite members' }, { status: 403 });
        }

        const { email } = await req.json();
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { name: true, slug: true, inviteCode: true },
        });
        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const invitee = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!invitee) {
            // No account with that email yet — share the invite code instead
            return NextResponse.json({
                pending: true,
                message: `No TaskFlow account uses ${email} yet. Share the invite code "${workspace.inviteCode}" with them — they can join after signing up.`,
            });
        }

        const existing = await getWorkspaceMembership(workspaceId, invitee.id);
        if (existing) {
            return NextResponse.json({ error: 'That person is already a member' }, { status: 409 });
        }

        await prisma.workspaceMember.create({
            data: { workspaceId, userId: invitee.id, role: 'member' },
        });

        await prisma.notification.create({
            data: {
                userId: invitee.id,
                type: 'invited',
                message: `${userName} added you to the "${workspace.name}" workspace`,
                linkUrl: `/w/${workspace.slug}`,
            },
        });

        return NextResponse.json({ ok: true, message: 'Member added and notified.' }, { status: 201 });
    } catch (error) {
        console.error('POST /api/workspaces/[workspaceId]/invite error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
