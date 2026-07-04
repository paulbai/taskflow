"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import type { OfficeWorkspace, PageMeta, DbMeta } from '@/lib/office-types';

interface OfficeContextType {
    workspaces: OfficeWorkspace[];
    workspace: OfficeWorkspace | null;
    pages: PageMeta[];
    databases: DbMeta[];
    loading: boolean;
    currentUserId: string;
    refreshWorkspaces: () => Promise<void>;
    refreshPages: () => Promise<void>;
    refreshDatabases: () => Promise<void>;
    createPage: (parentId?: string | null, isPrivate?: boolean) => Promise<string | null>;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
}

const OfficeContext = createContext<OfficeContextType>({
    workspaces: [],
    workspace: null,
    pages: [],
    databases: [],
    loading: true,
    currentUserId: '',
    refreshWorkspaces: async () => {},
    refreshPages: async () => {},
    refreshDatabases: async () => {},
    createPage: async () => null,
    sidebarCollapsed: false,
    setSidebarCollapsed: () => {},
});

export const useOffice = () => useContext(OfficeContext);

export function OfficeProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const params = useParams<{ workspaceSlug?: string }>();
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<OfficeWorkspace[]>([]);
    const [pages, setPages] = useState<PageMeta[]>([]);
    const [databases, setDatabases] = useState<DbMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

    const currentUserId = (session?.user as { id?: string } | undefined)?.id || '';
    const slug = params?.workspaceSlug;

    const workspace = useMemo(
        () => workspaces.find(w => w.slug === slug) || null,
        [workspaces, slug]
    );

    useEffect(() => {
        const stored = localStorage.getItem('office-sidebar-collapsed');
        if (stored === '1') setSidebarCollapsedState(true);
    }, []);

    const setSidebarCollapsed = useCallback((collapsed: boolean) => {
        setSidebarCollapsedState(collapsed);
        localStorage.setItem('office-sidebar-collapsed', collapsed ? '1' : '0');
    }, []);

    const refreshWorkspaces = useCallback(async () => {
        if (!session?.user) return;
        try {
            const res = await fetch('/api/workspaces');
            if (res.ok) setWorkspaces(await res.json());
        } catch {
            // network error; keep stale data
        }
    }, [session]);

    const refreshPages = useCallback(async () => {
        if (!workspace) return;
        try {
            const res = await fetch(`/api/pages?workspaceId=${workspace.id}`);
            if (res.ok) setPages(await res.json());
        } catch {
            // network error; keep stale data
        }
    }, [workspace]);

    const refreshDatabases = useCallback(async () => {
        if (!workspace) return;
        try {
            const res = await fetch(`/api/databases?workspaceId=${workspace.id}`);
            if (res.ok) setDatabases(await res.json());
        } catch {
            // network error; keep stale data
        }
    }, [workspace]);

    const createPage = useCallback(async (parentId?: string | null, isPrivate?: boolean): Promise<string | null> => {
        if (!workspace) return null;
        const res = await fetch('/api/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId: workspace.id, parentId: parentId || null, isPrivate: Boolean(isPrivate) }),
        });
        if (!res.ok) return null;
        const page = await res.json();
        await refreshPages();
        router.push(`/w/${workspace.slug}/page/${page.id}`);
        return page.id;
    }, [workspace, refreshPages, router]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await refreshWorkspaces();
            setLoading(false);
        })();
    }, [refreshWorkspaces]);

    useEffect(() => {
        refreshPages();
        refreshDatabases();
    }, [refreshPages, refreshDatabases]);

    return (
        <OfficeContext.Provider
            value={{
                workspaces,
                workspace,
                pages,
                databases,
                loading,
                currentUserId,
                refreshWorkspaces,
                refreshPages,
                refreshDatabases,
                createPage,
                sidebarCollapsed,
                setSidebarCollapsed,
            }}
        >
            {children}
        </OfficeContext.Provider>
    );
}
