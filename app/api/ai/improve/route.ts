import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAnthropicClient, AI_MODEL, AI_NOT_CONFIGURED_ERROR } from '@/lib/ai';
import { rateLimit, getClientId } from '@/lib/rate-limit';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`ai:${clientId}`, { maxRequests: 20, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many AI requests. Please slow down.' }, { status: 429 });
        }

        const client = getAnthropicClient();
        if (!client) {
            return NextResponse.json({ error: AI_NOT_CONFIGURED_ERROR }, { status: 503 });
        }

        const { text } = await req.json();
        if (!text || typeof text !== 'string' || text.length > 20_000) {
            return NextResponse.json({ error: 'text is required (max 20k characters)' }, { status: 400 });
        }

        const message = await client.messages.create({
            model: AI_MODEL,
            max_tokens: 2048,
            messages: [{
                role: 'user',
                content: `Improve the following text: fix grammar and spelling, tighten the wording, and make it clearer while preserving the original meaning, tone, and language. Respond ONLY with the improved text — no preamble, no explanations, no quotes around it.\n\n${text}`,
            }],
        });

        const block = message.content[0];
        return NextResponse.json({
            improved: block?.type === 'text' ? block.text : text,
        });
    } catch (error) {
        console.error('POST /api/ai/improve error:', error);
        return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
    }
}
