/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, consider Redis-based solutions (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    for (const key of keys) {
        const entry = store.get(key);
        if (entry && now > entry.resetTime) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

export function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }
): { success: boolean; remaining: number } {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || now > entry.resetTime) {
        store.set(identifier, { count: 1, resetTime: now + config.windowMs });
        return { success: true, remaining: config.maxRequests - 1 };
    }

    if (entry.count >= config.maxRequests) {
        return { success: false, remaining: 0 };
    }

    entry.count++;
    return { success: true, remaining: config.maxRequests - entry.count };
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
