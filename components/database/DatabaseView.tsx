"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
    Calendar,
    Columns,
    LayoutGrid,
    List,
    Table,
} from 'lucide-react';
import type { DbColumn, DbFull, DbRow, DbViewType } from '@/lib/office-types';
import { useOffice } from '@/components/office/OfficeContext';
import { useTopbar } from '@/components/office/TopbarState';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';
import { TableView } from './TableView';
import type { ViewProps } from './db-utils';
import styles from './DatabaseView.module.css';

const SAVE_DEBOUNCE_MS = 500;

const VIEW_TABS: { id: DbViewType; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
    { id: 'table', label: 'Table', icon: Table },
    { id: 'board', label: 'Board', icon: Columns },
    { id: 'gallery', label: 'Gallery', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
];

interface DatabaseViewProps {
    databaseId: string;
    fallbackView?: DbViewType;
}

export function DatabaseView({ databaseId, fallbackView }: DatabaseViewProps) {
    const { workspace, refreshDatabases } = useOffice();
    const { setCrumbs, setSaveStatus } = useTopbar();
    const [db, setDb] = useState<DbFull | null>(null);
    const [rows, setRows] = useState<DbRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<DbViewType | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    const rowsRef = useRef<DbRow[]>([]);
    rowsRef.current = rows;
    const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const members = workspace?.members || [];

    // ── Load ────────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [dbRes, rowsRes] = await Promise.all([
                    fetch(`/api/databases/${databaseId}`),
                    fetch(`/api/databases/${databaseId}/rows`),
                ]);
                if (!dbRes.ok) {
                    const body = await dbRes.json().catch(() => ({}));
                    throw new Error(body.error || 'Failed to load database');
                }
                if (!rowsRes.ok) throw new Error('Failed to load rows');
                const dbData: DbFull = await dbRes.json();
                const rowsData: DbRow[] = await rowsRes.json();
                if (cancelled) return;
                setDb(dbData);
                setTitleDraft(dbData.title);
                setRows(rowsData);
                const stored = typeof window !== 'undefined'
                    ? localStorage.getItem(`db-view-${databaseId}`) as DbViewType | null
                    : null;
                const validStored = stored && VIEW_TABS.some(t => t.id === stored) ? stored : null;
                setView(validStored || fallbackView || dbData.defaultView || 'table');
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load database');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [databaseId, fallbackView]);

    // ── Topbar crumbs ───────────────────────────────────────────

    useEffect(() => {
        if (db) setCrumbs([{ label: db.title, emoji: db.iconEmoji }]);
        return () => setCrumbs([]);
    }, [db, setCrumbs]);

    // Flush pending row saves on unmount so quick edits are not lost
    useEffect(() => {
        const timers = pendingTimers.current;
        return () => {
            timers.forEach((timer, rowId) => {
                clearTimeout(timer);
                const row = rowsRef.current.find(r => r.id === rowId);
                if (!row) return;
                fetch(`/api/databases/${databaseId}/rows/${rowId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: row.data }),
                    keepalive: true,
                }).catch(() => {});
            });
            timers.clear();
        };
    }, [databaseId]);

    // ── Poll rows every 10s for teammate changes ────────────────
    useEffect(() => {
        if (!db) return;
        const interval = setInterval(async () => {
            // Skip while local edits are pending so we don't clobber them
            if (document.visibilityState !== 'visible' || pendingTimers.current.size > 0) return;
            try {
                const res = await fetch(`/api/databases/${databaseId}/rows`);
                if (res.ok) setRows(await res.json());
            } catch {
                // offline — skip this poll
            }
        }, 10_000);
        return () => clearInterval(interval);
    }, [db, databaseId]);

    const switchView = (next: DbViewType) => {
        setView(next);
        localStorage.setItem(`db-view-${databaseId}`, next);
    };

    // ── Persistence ─────────────────────────────────────────────

    const patchDb = useCallback(async (body: Record<string, unknown>) => {
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/databases/${databaseId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setSaveStatus('saved');
                refreshDatabases();
            } else {
                setSaveStatus('');
            }
        } catch {
            setSaveStatus('');
        }
    }, [databaseId, setSaveStatus, refreshDatabases]);

    const onUpdateRow = useCallback((rowId: string, data: Record<string, unknown>) => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, ...data } } : r));
        const existing = pendingTimers.current.get(rowId);
        if (existing) clearTimeout(existing);
        setSaveStatus('saving');
        pendingTimers.current.set(rowId, setTimeout(async () => {
            pendingTimers.current.delete(rowId);
            const row = rowsRef.current.find(r => r.id === rowId);
            if (!row) return;
            try {
                const res = await fetch(`/api/databases/${databaseId}/rows/${rowId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: row.data }),
                });
                setSaveStatus(res.ok ? 'saved' : '');
            } catch {
                setSaveStatus('');
            }
        }, SAVE_DEBOUNCE_MS));
    }, [databaseId, setSaveStatus]);

    const onCreateRow = useCallback(async (data: Record<string, unknown>) => {
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/databases/${databaseId}/rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
            if (res.ok) {
                const row: DbRow = await res.json();
                setRows(prev => [...prev, row]);
                setSaveStatus('saved');
            } else {
                setSaveStatus('');
            }
        } catch {
            setSaveStatus('');
        }
    }, [databaseId, setSaveStatus]);

    const onDeleteRow = useCallback(async (rowId: string) => {
        setRows(prev => prev.filter(r => r.id !== rowId));
        try {
            await fetch(`/api/databases/${databaseId}/rows/${rowId}`, { method: 'DELETE' });
        } catch {
            // row already removed locally; a refresh will restore if the delete failed
        }
    }, [databaseId]);

    const onUpdateSchema = useCallback((schema: DbColumn[]) => {
        setDb(prev => prev ? { ...prev, schema } : prev);
        patchDb({ schema });
    }, [patchDb]);

    const commitTitle = () => {
        if (!db) return;
        const next = titleDraft.trim();
        if (!next || next === db.title) {
            setTitleDraft(db.title);
            return;
        }
        setDb({ ...db, title: next });
        patchDb({ title: next });
    };

    const editEmoji = () => {
        if (!db) return;
        const emoji = window.prompt('Icon emoji', db.iconEmoji || '');
        if (emoji === null) return;
        const next = emoji.trim().slice(0, 4) || null;
        setDb({ ...db, iconEmoji: next });
        patchDb({ iconEmoji: next });
    };

    // ── Render ──────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={styles.state}>
                <div className={styles.stateEmoji}>🗂️</div>
                Loading database…
            </div>
        );
    }

    if (error || !db) {
        return (
            <div className={styles.state}>
                <div className={styles.stateEmoji}>🚧</div>
                <div className={styles.stateTitle}>Couldn&apos;t load this database</div>
                {error || 'Unknown error'}
            </div>
        );
    }

    const activeView = view || 'table';
    const viewProps: ViewProps = {
        db,
        rows,
        members,
        onUpdateRow,
        onCreateRow,
        onDeleteRow,
        onUpdateSchema,
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <button className={styles.emojiBtn} title="Change icon" onClick={editEmoji}>
                        {db.iconEmoji || '🗂️'}
                    </button>
                    <input
                        className={styles.titleInput}
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        aria-label="Database title"
                    />
                </div>
                <div className={styles.metaRow}>
                    <div className={styles.tabs}>
                        {VIEW_TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    className={clsx(styles.tab, activeView === tab.id && styles.tabActive)}
                                    onClick={() => switchView(tab.id)}
                                >
                                    <Icon size={13} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <span className={styles.rowCount}>
                        {rows.length} row{rows.length === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {activeView === 'table' && <TableView {...viewProps} />}
            {activeView === 'board' && <BoardView {...viewProps} />}
            {activeView === 'gallery' && <GalleryView {...viewProps} />}
            {activeView === 'list' && <ListView {...viewProps} />}
            {activeView === 'calendar' && <CalendarView {...viewProps} />}
        </div>
    );
}
