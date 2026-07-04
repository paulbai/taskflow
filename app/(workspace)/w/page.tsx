import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceSlug } from '@/lib/office';

export const dynamic = 'force-dynamic';

export default async function WorkspaceIndexPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/signin');

    const userId = (session.user as { id: string }).id;

    const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: { select: { id: true, name: true, slug: true } } },
        orderBy: { id: 'asc' },
    });

    if (!membership) {
        // No workspace yet — send them to classic TaskFlow to create one
        redirect('/');
    }

    const slug = await ensureWorkspaceSlug(
        membership.workspace.id,
        membership.workspace.name,
        membership.workspace.slug
    );

    redirect(`/w/${slug}`);
}
