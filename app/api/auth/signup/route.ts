import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    // Rate limit: 5 signups per 10 minutes per IP
    const clientId = getClientId(req);
    const { success: allowed } = rateLimit(`signup:${clientId}`, { maxRequests: 5, windowMs: 600_000 });
    if (!allowed) {
        return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
            return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
        }

        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        if (password.length > 128) {
            return NextResponse.json({ error: 'Password must be under 128 characters' }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { name, email, hashedPassword },
        });

        // Create a default personal list for the new user
        const inviteCode = crypto.randomBytes(6).toString('hex');
        await prisma.list.create({
            data: {
                name: 'My Tasks',
                icon: '📝',
                ownerId: user.id,
                inviteCode,
                members: {
                    create: { userId: user.id, role: 'owner' },
                },
            },
        });

        return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
    } catch (err) {
        console.error('Signup error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
    }
}
