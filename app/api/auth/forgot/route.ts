import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientId } from '@/lib/rate-limit';
import { sendPasswordResetEmail, isEmailConfigured } from '@/lib/email';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
    try {
        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`forgot:${clientId}`, { maxRequests: 5, windowMs: 600_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many reset requests. Please try again later.' }, { status: 429 });
        }

        if (!isEmailConfigured()) {
            return NextResponse.json({
                error: 'Password reset emails are not set up yet. Please contact the workspace owner to reset your password.',
            }, { status: 503 });
        }

        const { email } = await req.json();
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
        }

        // Always respond identically whether or not the account exists,
        // so this endpoint can't be used to enumerate registered emails.
        const genericResponse = NextResponse.json({
            message: 'If an account uses that email, a reset link is on its way. Check your inbox.',
        });

        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) return genericResponse;

        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
            },
        });

        const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        await sendPasswordResetEmail(email, resetUrl);

        return genericResponse;
    } catch (error) {
        console.error('POST /api/auth/forgot error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
