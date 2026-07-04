import Anthropic from '@anthropic-ai/sdk';

/** Model used for all AI features. */
export const AI_MODEL = 'claude-sonnet-4-6';

/** Returns an Anthropic client, or null when ANTHROPIC_API_KEY is not configured. */
export function getAnthropicClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    return new Anthropic();
}

export const AI_NOT_CONFIGURED_ERROR =
    'AI features are not configured yet. Add an ANTHROPIC_API_KEY environment variable to enable them.';
