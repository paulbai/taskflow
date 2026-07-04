import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceSlug } from '@/lib/office';
import crypto from 'crypto';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;

        const workspaces = await prisma.workspace.findMany({
            where: { members: { some: { userId } } },
            include: {
                members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
                boards: { include: { _count: { select: { tasks: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Lazily generate slugs for workspaces created before the Office OS upgrade
        const slugs = await Promise.all(
            workspaces.map(w => ensureWorkspaceSlug(w.id, w.name, w.slug))
        );

        const result = workspaces.map((w, i) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            description: w.description,
            slug: slugs[i],
            iconEmoji: w.iconEmoji,
            ownerId: w.ownerId,
            inviteCode: w.ownerId === userId ? w.inviteCode : undefined,
            createdAt: w.createdAt.toISOString(),
            members: w.members.map(m => ({
                id: m.id,
                userId: m.user.id,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                avatar: m.user.avatar,
            })),
            boards: w.boards.map(b => ({
                id: b.id,
                name: b.name,
                description: b.description,
                workspaceId: b.workspaceId,
                inviteCode: b.inviteCode,
                taskCount: b._count.tasks,
                createdAt: b.createdAt.toISOString(),
            })),
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('GET /api/workspaces error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { name, type, description } = await req.json();

        if (!name?.trim() || typeof name !== 'string' || name.trim().length > 100) {
            return NextResponse.json({ error: 'Name is required (max 100 characters)' }, { status: 400 });
        }

        const validTypes = ['company', 'family', 'team', 'other'];
        if (type && !validTypes.includes(type)) {
            return NextResponse.json({ error: 'Invalid workspace type' }, { status: 400 });
        }

        if (description && (typeof description !== 'string' || description.length > 500)) {
            return NextResponse.json({ error: 'Description must be under 500 characters' }, { status: 400 });
        }

        const inviteCode = crypto.randomBytes(6).toString('hex').toUpperCase();

        const workspace = await prisma.workspace.create({
            data: {
                name: name.trim(),
                type: type || 'team',
                description: description?.trim() || null,
                ownerId: userId,
                inviteCode,
                members: {
                    create: { userId, role: 'owner' },
                },
            },
            include: {
                members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
            },
        });

        const slug = await ensureWorkspaceSlug(workspace.id, workspace.name, workspace.slug);

        return NextResponse.json({
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            description: workspace.description,
            slug,
            iconEmoji: workspace.iconEmoji,
            ownerId: workspace.ownerId,
            inviteCode: workspace.inviteCode,
            createdAt: workspace.createdAt.toISOString(),
            members: workspace.members.map(m => ({
                id: m.id,
                userId: m.user.id,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                avatar: m.user.avatar,
            })),
            boards: [],
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/workspaces error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
