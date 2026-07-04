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

        const { content } = await req.json();
        if (!content || typeof content !== 'string' || content.length > 100_000) {
            return NextResponse.json({ error: 'content is required (max 100k characters)' }, { status: 400 });
        }

        const message = await client.messages.create({
            model: AI_MODEL,
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: `Summarize this page content in 3-5 bullet points. Be concise and focus on key takeaways.\n\n${content}`,
            }],
        });

        const block = message.content[0];
        return NextResponse.json({
            summary: block?.type === 'text' ? block.text : '',
        });
    } catch (error) {
        console.error('POST /api/ai/summarize error:', error);
        return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
    }
}
