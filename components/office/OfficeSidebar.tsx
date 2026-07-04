"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
    ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Plus,
    MoreHorizontal, Star, Trash2, Pencil, Lock, FileText,
    Table2, CheckSquare, Settings, Home, Search,
} from 'lucide-react';
import styles from './OfficeSidebar.module.css';
import { useOffice } from './OfficeContext';
import type { PageMeta } from '@/lib/office-types';

interface ContextMenuState {
    pageId: string;
    x: number;
    y: number;
}

interface OfficeSidebarProps {
    mobileOpen: boolean;
    onMobileClose: () => void;
    onOpenSearch: () => void;
}

export function OfficeSidebar({ mobileOpen, onMobileClose, onOpenSearch }: OfficeSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        workspaces, workspace, pages, databases, currentUserId,
        createPage, refreshPages, sidebarCollapsed, setSidebarCollapsed,
    } = useOffice();

    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Close popups on outside click
    useEffect(() => {
        if (!contextMenu && !switcherOpen) return;
        const close = () => { setContextMenu(null); setSwitcherOpen(false); };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [contextMenu, switcherOpen]);

    const favourites = useMemo(() => pages.filter(p => p.isFavorite), [pages]);
    const privatePages = useMemo(
        () => pages.filter(p => p.isPrivate && p.createdById === currentUserId && !p.parentId),
        [pages, currentUserId]
    );
    const sharedPages = useMemo(
        () => pages.filter(p => !p.isPrivate && !p.parentId),
        [pages]
    );

    const childrenOf = useCallback(
        (parentId: string) => pages.filter(p => p.parentId === parentId),
        [pages]
    );

    const toggleExpand = useCallback((id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const navigate = useCallback((href: string) => {
        router.push(href);
        onMobileClose();
    }, [router, onMobileClose]);

    const patchPage = useCallback(async (pageId: string, body: Record<string, unknown>) => {
        await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        await refreshPages();
    }, [refreshPages]);

    const archivePage = useCallback(async (pageId: string) => {
        await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
        await refreshPages();
        if (pathname?.includes(pageId) && workspace) {
            router.push(`/w/${workspace.slug}`);
        }
    }, [refreshPages, pathname, workspace, router]);

    const duplicatePage = useCallback(async (page: PageMeta) => {
        if (!workspace) return;
        const full = await fetch(`/api/pages/${page.id}`);
        if (!full.ok) return;
        const data = await full.json();
        const res = await fetch('/api/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspaceId: workspace.id,
                parentId: page.parentId,
                title: `${page.title} (copy)`,
                iconEmoji: page.iconEmoji,
                isPrivate: page.isPrivate,
            }),
        });
        if (res.ok) {
            const created = await res.json();
            await fetch(`/api/pages/${created.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: data.content }),
            });
            await refreshPages();
        }
    }, [workspace, refreshPages]);

    const startRename = useCallback((page: PageMeta) => {
        setRenamingId(page.id);
        setRenameValue(page.title);
        setContextMenu(null);
    }, []);

    const commitRename = useCallback(async () => {
        if (renamingId && renameValue.trim()) {
            await patchPage(renamingId, { title: renameValue.trim() });
        }
        setRenamingId(null);
    }, [renamingId, renameValue, patchPage]);

    const renderPage = (page: PageMeta, depth: number) => {
        const kids = childrenOf(page.id);
        const isExpanded = expanded.has(page.id);
        const isActive = pathname?.includes(`/page/${page.id}`);
        const menuPage = contextMenu?.pageId === page.id;

        return (
            <div key={page.id}>
                <div
                    className={clsx(styles.item, isActive && styles.active)}
                    style={{ paddingLeft: 8 + depth * 16 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => workspace && navigate(`/w/${workspace.slug}/page/${page.id}`)}
                    onKeyDown={e => { if (e.key === 'Enter') workspace && navigate(`/w/${workspace.slug}/page/${page.id}`); }}
                >
                    <button
                        className={styles.itemChevron}
                        onClick={e => { e.stopPropagation(); toggleExpand(page.id); }}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        tabIndex={-1}
                    >
                        {kids.length > 0
                            ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                            : <FileText size={13} />}
                    </button>
                    <span className={styles.itemIcon}>{page.iconEmoji || '📄'}</span>
                    {renamingId === page.id ? (
                        <input
                            autoFocus
                            className={styles.itemTitle}
                            style={{ border: 'none', background: 'var(--bg-raised)', outline: 'none', fontSize: 14, borderRadius: 6, padding: '2px 6px' }}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span className={styles.itemTitle}>{page.title}</span>
                    )}
                    <span className={styles.itemActions}>
                        <button
                            className={styles.itemActionBtn}
                            aria-label="Page menu"
                            onClick={e => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setContextMenu(menuPage ? null : { pageId: page.id, x: rect.right, y: rect.bottom + 4 });
                            }}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                        <button
                            className={styles.itemActionBtn}
                            aria-label="Add sub-page"
                            onClick={e => { e.stopPropagation(); createPage(page.id, page.isPrivate); }}
                        >
                            <Plus size={14} />
                        </button>
                    </span>
                </div>
                {isExpanded && kids.map(kid => renderPage(kid, depth + 1))}
            </div>
        );
    };

    const contextPage = contextMenu ? pages.find(p => p.id === contextMenu.pageId) : null;

    if (!workspace) return null;

    // Collapsed rail (desktop)
    if (sidebarCollapsed && !mobileOpen) {
        return (
            <aside className={clsx(styles.sidebar, styles.collapsed)}>
                <div className={styles.collapsedRail}>
                    <button className={styles.railBtn} onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar">
                        <ChevronsRight size={18} />
                    </button>
                    <button className={styles.railBtn} onClick={() => navigate(`/w/${workspace.slug}`)} aria-label="Home">
                        <Home size={18} />
                    </button>
                    <button className={styles.railBtn} onClick={onOpenSearch} aria-label="Search">
                        <Search size={18} />
                    </button>
                    <button className={styles.railBtn} onClick={() => navigate(`/w/${workspace.slug}/tasks`)} aria-label="Tasks">
                        <CheckSquare size={18} />
                    </button>
                    <button className={styles.railBtn} onClick={() => navigate(`/w/${workspace.slug}/settings`)} aria-label="Settings">
                        <Settings size={18} />
                    </button>
                    <button className={styles.railBtn} onClick={() => createPage()} aria-label="New page">
                        <Plus size={18} />
                    </button>
                </div>
            </aside>
        );
    }

    return (
        <>
            {mobileOpen && <div className={styles.mobileOverlay} onClick={onMobileClose} />}
            <aside className={clsx(styles.sidebar, mobileOpen && styles.mobileOpen)}>
                <button
                    className={styles.switcher}
                    onClick={e => { e.stopPropagation(); setSwitcherOpen(o => !o); }}
                >
                    <span className={styles.wsIcon}>{workspace.iconEmoji}</span>
                    <span className={styles.wsName}>{workspace.name}</span>
                    <ChevronDown size={16} className={styles.wsChevron} />
                </button>
                <button
                    className={styles.collapseBtn}
                    onClick={() => { setSidebarCollapsed(true); onMobileClose(); }}
                    aria-label="Collapse sidebar"
                >
                    <ChevronsLeft size={16} />
                </button>

                {switcherOpen && (
                    <div className={styles.switcherMenu} onClick={e => e.stopPropagation()}>
                        {workspaces.map(w => (
                            <button
                                key={w.id}
                                className={clsx(styles.switcherItem, w.id === workspace.id && styles.active)}
                                onClick={() => { setSwitcherOpen(false); navigate(`/w/${w.slug}`); }}
                            >
                                <span>{w.iconEmoji}</span>
                                <span>{w.name}</span>
                            </button>
                        ))}
                        <button
                            className={styles.switcherItem}
                            onClick={() => { setSwitcherOpen(false); navigate('/'); }}
                        >
                            <span>↩️</span>
                            <span>Back to TaskFlow</span>
                        </button>
                    </div>
                )}

                <div className={styles.scroll}>
                    <div className={styles.section}>
                        <button className={styles.item} onClick={() => navigate(`/w/${workspace.slug}`)}>
                            <span className={styles.itemChevron}><Home size={14} /></span>
                            <span className={styles.itemTitle}>Home</span>
                        </button>
                        <button className={styles.item} onClick={onOpenSearch}>
                            <span className={styles.itemChevron}><Search size={14} /></span>
                            <span className={styles.itemTitle}>Search</span>
                        </button>
                        <button
                            className={clsx(styles.item, pathname?.endsWith('/tasks') && styles.active)}
                            onClick={() => navigate(`/w/${workspace.slug}/tasks`)}
                        >
                            <span className={styles.itemChevron}><CheckSquare size={14} /></span>
                            <span className={styles.itemTitle}>Tasks</span>
                        </button>
                    </div>

                    {favourites.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>Favourites</div>
                            {favourites.map(p => (
                                <button
                                    key={p.id}
                                    className={clsx(styles.item, pathname?.includes(`/page/${p.id}`) && styles.active)}
                                    onClick={() => navigate(`/w/${workspace.slug}/page/${p.id}`)}
                                >
                                    <span className={styles.itemChevron}><Star size={13} fill="currentColor" /></span>
                                    <span className={styles.itemIcon}>{p.iconEmoji || '📄'}</span>
                                    <span className={styles.itemTitle}>{p.title}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>
                            Shared
                            <button className={styles.sectionAdd} onClick={() => createPage(null, false)} aria-label="New shared page">
                                <Plus size={14} />
                            </button>
                        </div>
                        {sharedPages.length === 0 && <div className={styles.emptyHint}>No pages yet</div>}
                        {sharedPages.map(p => renderPage(p, 0))}
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>
                            Private
                            <button className={styles.sectionAdd} onClick={() => createPage(null, true)} aria-label="New private page">
                                <Plus size={14} />
                            </button>
                        </div>
                        {privatePages.length === 0 && <div className={styles.emptyHint}>Only visible to you</div>}
                        {privatePages.map(p => renderPage(p, 0))}
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>Databases</div>
                        {databases.length === 0 && <div className={styles.emptyHint}>No databases yet</div>}
                        {databases.map(db => (
                            <button
                                key={db.id}
                                className={clsx(styles.item, pathname?.includes(`/db/${db.id}`) && styles.active)}
                                onClick={() => navigate(`/w/${workspace.slug}/db/${db.id}`)}
                            >
                                <span className={styles.itemChevron}><Table2 size={13} /></span>
                                <span className={styles.itemIcon}>{db.iconEmoji || '🗂️'}</span>
                                <span className={styles.itemTitle}>{db.title}</span>
                            </button>
                        ))}
                    </div>

                    <button className={styles.newPageBtn} onClick={() => createPage()}>
                        <Plus size={16} />
                        New page
                    </button>
                </div>

                <div className={styles.bottom}>
                    <button
                        className={clsx(styles.item, pathname?.endsWith('/settings') && styles.active)}
                        onClick={() => navigate(`/w/${workspace.slug}/settings`)}
                    >
                        <span className={styles.itemChevron}><Settings size={14} /></span>
                        <span className={styles.itemTitle}>Settings</span>
                    </button>
                </div>

                {contextMenu && contextPage && (
                    <div
                        className={styles.contextMenu}
                        style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: contextMenu.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className={styles.contextMenuItem} onClick={() => startRename(contextPage)}>
                            <Pencil size={14} /> Rename
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => { patchPage(contextPage.id, { isFavorite: !contextPage.isFavorite }); setContextMenu(null); }}
                        >
                            <Star size={14} /> {contextPage.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => { duplicatePage(contextPage); setContextMenu(null); }}
                        >
                            <FileText size={14} /> Duplicate
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => { patchPage(contextPage.id, { isPrivate: !contextPage.isPrivate }); setContextMenu(null); }}
                        >
                            <Lock size={14} /> {contextPage.isPrivate ? 'Make shared' : 'Make private'}
                        </button>
                        <button
                            className={clsx(styles.contextMenuItem, styles.danger)}
                            onClick={() => { archivePage(contextPage.id); setContextMenu(null); }}
                        >
                            <Trash2 size={14} /> Archive
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
