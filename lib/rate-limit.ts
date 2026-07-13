/**
 * Rate limiter with Upstash Redis for production (serverless-safe)
 * and in-memory fallback for local development.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
 * to enable Redis-backed rate limiting in production.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Redis-backed rate limiter (production) ──────────────────────

let redisRatelimit: Ratelimit | null = null;

// Support both direct Upstash env names and Vercel Marketplace KV_* names
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (REDIS_URL && REDIS_TOKEN) {
    const redis = new Redis({
        url: REDIS_URL,
        token: REDIS_TOKEN,
    });

    redisRatelimit = new Ratelimit({
        redis,
        // Default: 10 requests per 60 seconds using sliding window
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        analytics: true,
        prefix: 'taskflow-rl',
    });
}

// ── In-memory fallback (local dev only) ─────────────────────────

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        const keys = Array.from(memoryStore.keys());
        for (const key of keys) {
            const entry = memoryStore.get(key);
            if (entry && now > entry.resetTime) {
                memoryStore.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

function memoryRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
): { success: boolean; remaining: number } {
    const now = Date.now();
    const entry = memoryStore.get(identifier);

    if (!entry || now > entry.resetTime) {
        memoryStore.set(identifier, { count: 1, resetTime: now + windowMs });
        return { success: true, remaining: maxRequests - 1 };
    }

    if (entry.count >= maxRequests) {
        return { success: false, remaining: 0 };
    }

    entry.count++;
    return { success: true, remaining: maxRequests - entry.count };
}

// ── Public API ──────────────────────────────────────────────────

export interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

/**
 * Rate limit a request by identifier.
 * Uses Upstash Redis in production, falls back to in-memory for local dev.
 */
export async function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }
): Promise<{ success: boolean; remaining: number }> {
    // Use Redis in production
    if (redisRatelimit) {
        const key = `${identifier}:${config.maxRequests}:${config.windowMs}`;
        const result = await redisRatelimit.limit(key);
        return { success: result.success, remaining: result.remaining };
    }

    // Fallback to in-memory for local development
    return memoryRateLimit(identifier, config.maxRequests, config.windowMs);
}

/**
 * Extract a client identifier from a request.
 * Uses X-Forwarded-For header (set by proxies/Vercel) or falls back to a generic key.
 */
export function getClientId(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}
