import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    try {
        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`reset:${clientId}`, { maxRequests: 10, windowMs: 600_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
        }

        const { token, password } = await req.json();

        if (!token || typeof token !== 'string' || token.length > 200) {
            return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 });
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }
        if (password.length > 128) {
            return NextResponse.json({ error: 'Password must be under 128 characters' }, { status: 400 });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
        });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            return NextResponse.json({
                error: 'This reset link is invalid or has expired. Please request a new one.',
            }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { hashedPassword },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
            // Invalidate any other outstanding tokens for this user
            prisma.passwordResetToken.deleteMany({
                where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
            }),
        ]);

        return NextResponse.json({ message: 'Password updated. You can sign in now.' });
    } catch (error) {
        console.error('POST /api/auth/reset error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
