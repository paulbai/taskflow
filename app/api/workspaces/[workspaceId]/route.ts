import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership, slugify } from '@/lib/office';

export async function PATCH(req: Request, { params }: { params: { workspaceId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId } = params;

        const membership = await getWorkspaceMembership(workspaceId, userId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return NextResponse.json({ error: 'Only owners and admins can update the workspace' }, { status: 403 });
        }

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
                return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
            }
            updateData.name = body.name.trim();
        }
        if (body.iconEmoji !== undefined) {
            if (typeof body.iconEmoji !== 'string' || body.iconEmoji.length > 10) {
                return NextResponse.json({ error: 'Invalid icon' }, { status: 400 });
            }
            updateData.iconEmoji = body.iconEmoji;
        }
        if (body.slug !== undefined) {
            if (typeof body.slug !== 'string' || !body.slug.trim()) {
                return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
            }
            const cleaned = slugify(body.slug);
            if (!cleaned || cleaned === 'workspace') {
                return NextResponse.json({ error: 'Slug must contain letters or numbers' }, { status: 400 });
            }
            const taken = await prisma.workspace.findUnique({ where: { slug: cleaned }, select: { id: true } });
            if (taken && taken.id !== workspaceId) {
                return NextResponse.json({ error: 'That URL is already taken' }, { status: 409 });
            }
            updateData.slug = cleaned;
        }
        if (body.description !== undefined) {
            if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 500)) {
                return NextResponse.json({ error: 'Description must be under 500 characters' }, { status: 400 });
            }
            updateData.description = body.description;
        }

        const updated = await prisma.workspace.update({
            where: { id: workspaceId },
            data: updateData,
            select: { id: true, name: true, slug: true, iconEmoji: true, description: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/workspaces/[workspaceId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { workspaceId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { workspaceId } = params;

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true, name: true },
        });
        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }
        if (workspace.ownerId !== userId) {
            return NextResponse.json({ error: 'Only the owner can delete the workspace' }, { status: 403 });
        }

        // Require the exact workspace name as confirmation
        const { confirmName } = await req.json().catch(() => ({ confirmName: null }));
        if (confirmName !== workspace.name) {
            return NextResponse.json({ error: 'Confirmation name does not match' }, { status: 400 });
        }

        await prisma.workspace.delete({ where: { id: workspaceId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/workspaces/[workspaceId] error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
