import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as { id: string }).id;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false },
        });

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error('GET /api/notifications error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
