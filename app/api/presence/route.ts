import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkspaceMembership } from '@/lib/office';
import { updatePresence, getPresence } from '@/lib/presence';

async function checkPageAccess(pageId: string, userId: string): Promise<boolean> {
    const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { workspaceId: true },
    });
    if (!page) return false;
    const membership = await getWorkspaceMembership(page.workspaceId, userId);
    return Boolean(membership);
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;
        const { pageId } = await req.json();

        if (!pageId || typeof pageId !== 'string') {
            return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
        }
        if (!(await checkPageAccess(pageId, userId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await updatePresence(pageId, { userId, name: session.user.name || 'Someone' });
        const others = (await getPresence(pageId)).filter(e => e.userId !== userId);

        return NextResponse.json({ presence: others });
    } catch (error) {
        console.error('POST /api/presence error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
