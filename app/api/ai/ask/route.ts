import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAnthropicClient, AI_MODEL, AI_NOT_CONFIGURED_ERROR } from '@/lib/ai';
import { rateLimit, getClientId } from '@/lib/rate-limit';

interface AskMessage {
    role: 'user' | 'assistant';
    content: string;
}

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

        const { messages, pageContext } = await req.json();

        if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
            return NextResponse.json({ error: 'messages array is required (max 40)' }, { status: 400 });
        }
        for (const m of messages as AskMessage[]) {
            if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || m.content.length > 20_000) {
                return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
            }
        }
        if (pageContext !== undefined && (typeof pageContext !== 'string' || pageContext.length > 100_000)) {
            return NextResponse.json({ error: 'Invalid page context' }, { status: 400 });
        }

        const system = pageContext
            ? `You are a helpful workspace assistant inside TaskFlow Office. The user is currently viewing a page with the following content:\n\n<page_content>\n${pageContext}\n</page_content>\n\nAnswer questions about this page when relevant. Be concise and practical.`
            : 'You are a helpful workspace assistant inside TaskFlow Office. Be concise and practical.';

        const stream = client.messages.stream({
            model: AI_MODEL,
            max_tokens: 2048,
            system,
            messages: messages as AskMessage[],
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of stream) {
                        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                            controller.enqueue(encoder.encode(event.delta.text));
                        }
                    }
                } catch (err) {
                    console.error('AI stream error:', err);
                    controller.enqueue(encoder.encode('\n\n[The response was interrupted. Please try again.]'));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('POST /api/ai/ask error:', error);
        return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
    }
}
