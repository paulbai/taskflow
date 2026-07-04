/**
 * Lightweight page presence tracking.
 * Uses Upstash Redis when configured; falls back to in-memory for local dev.
 */

import { Redis } from '@upstash/redis';

export interface PresenceEntry {
    userId: string;
    name: string;
    lastSeen: number;
}

const TTL_SECONDS = 30;

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
}

// In-memory fallback (single-instance dev only)
const memoryPresence = new Map<string, PresenceEntry[]>();

export async function updatePresence(pageId: string, entry: Omit<PresenceEntry, 'lastSeen'>): Promise<void> {
    const now = Date.now();
    const fresh: PresenceEntry = { ...entry, lastSeen: now };

    if (redis) {
        const key = `presence:${pageId}`;
        const existing = await redis.get<PresenceEntry[]>(key) || [];
        const next = existing.filter(e => e.userId !== entry.userId && now - e.lastSeen < TTL_SECONDS * 1000);
        next.push(fresh);
        await redis.set(key, next, { ex: TTL_SECONDS });
        return;
    }

    const existing = memoryPresence.get(pageId) || [];
    const next = existing.filter(e => e.userId !== entry.userId && now - e.lastSeen < TTL_SECONDS * 1000);
    next.push(fresh);
    memoryPresence.set(pageId, next);
}

export async function getPresence(pageId: string): Promise<PresenceEntry[]> {
    const now = Date.now();

    if (redis) {
        const entries = await redis.get<PresenceEntry[]>(`presence:${pageId}`) || [];
        return entries.filter(e => now - e.lastSeen < TTL_SECONDS * 1000);
    }

    const entries = memoryPresence.get(pageId) || [];
    return entries.filter(e => now - e.lastSeen < TTL_SECONDS * 1000);
}
