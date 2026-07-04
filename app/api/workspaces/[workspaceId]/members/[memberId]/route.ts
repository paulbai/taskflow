import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';

const VALID_ROLES = ['admin', 'member', 'viewer'];

export async function PATCH(req: Request, { params }: { params: { workspaceId: string; memberId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId, memberId } = params;

        const actorMembership = await getWorkspaceMembership(workspaceId, userId);
        if (!actorMembership || (actorMembership.role !== 'owner' && actorMembership.role !== 'admin')) {
            return NextResponse.json({ error: 'Only owners and admins can change roles' }, { status: 403 });
        }

        const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
        if (!target || target.workspaceId !== workspaceId) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        if (target.role === 'owner') {
            return NextResponse.json({ error: 'The owner role cannot be changed' }, { status: 400 });
        }

        const { role } = await req.json();
        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const updated = await prisma.workspaceMember.update({
            where: { id: memberId },
            data: { role },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/workspaces/[workspaceId]/members/[memberId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { workspaceId: string; memberId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId, memberId } = params;

        const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
        if (!target || target.workspaceId !== workspaceId) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        const actorMembership = await getWorkspaceMembership(workspaceId, userId);
        if (!actorMembership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const isSelf = target.userId === userId;
        const isPrivileged = actorMembership.role === 'owner' || actorMembership.role === 'admin';

        // Members can remove themselves (leave); owners/admins can remove others
        if (!isSelf && !isPrivileged) {
            return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
        }
        if (target.role === 'owner') {
            return NextResponse.json({ error: 'The owner cannot be removed. Delete the workspace instead.' }, { status: 400 });
        }

        await prisma.workspaceMember.delete({ where: { id: memberId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/workspaces/[workspaceId]/members/[memberId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
