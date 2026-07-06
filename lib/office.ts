import { prisma } from './prisma';

/** Convert a workspace name into a URL-safe slug. */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48) || 'workspace';
}

/** Ensure a workspace has a slug, generating one from its name if missing. */
export async function ensureWorkspaceSlug(workspaceId: string, name: string, existingSlug: string | null): Promise<string> {
    if (existingSlug) return existingSlug;

    const base = slugify(name);
    let candidate = base;
    let attempt = 0;

    // Find a free slug (append short suffix on collision)
    while (attempt < 10) {
        const taken = await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } });
        if (!taken || taken.id === workspaceId) break;
        attempt++;
        candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    await prisma.workspace.update({ where: { id: workspaceId }, data: { slug: candidate } });
    return candidate;
}

/** Check the user is a member of the workspace. Returns membership or null. */
export async function getWorkspaceMembership(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
}

/** Resolve a workspace by slug and verify membership in one shot. */
export async function getWorkspaceBySlugForUser(slug: string, userId: string) {
    const workspace = await prisma.workspace.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, iconEmoji: true, ownerId: true, type: true },
    });
    if (!workspace) return null;

    const membership = await getWorkspaceMembership(workspace.id, userId);
    if (!membership) return null;

    return { workspace, membership };
}

/** Safe JSON parse that returns a fallback on error. */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export const VALID_DB_VIEWS = ['table', 'board', 'calendar', 'gallery', 'list'];
export const VALID_COLUMN_TYPES = ['text', 'number', 'select', 'multiSelect', 'date', 'person', 'checkbox', 'url', 'formula', 'files'];

/** Validate a database schema definition. Returns an error message or null if valid. */
export function validateDbSchema(schema: unknown): string | null {
    if (!Array.isArray(schema)) return 'Schema must be an array of column definitions';
    if (schema.length > 50) return 'Too many columns (max 50)';
    for (const col of schema) {
        if (!col || typeof col !== 'object') return 'Each column must be an object';
        const c = col as Record<string, unknown>;
        if (typeof c.id !== 'string' || !c.id) return 'Each column needs an id';
        if (typeof c.name !== 'string' || !c.name || c.name.length > 100) return 'Each column needs a name (max 100 chars)';
        if (typeof c.type !== 'string' || !VALID_COLUMN_TYPES.includes(c.type)) return `Invalid column type: ${c.type}`;
    }
    return null;
}
