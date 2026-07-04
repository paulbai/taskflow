"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Table2, CheckSquare } from 'lucide-react';
import styles from './SearchModal.module.css';
import { useOffice } from './OfficeContext';

interface SearchResult {
    id: string;
    title: string;
    emoji: string;
    href: string;
    group: 'Pages' | 'Databases' | 'Tasks';
}

/** Simple fuzzy match: all query chars must appear in order. Returns match quality or -1. */
function fuzzyScore(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) return 100 - t.indexOf(q); // substring match ranks highest
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length ? 10 : -1;
}

function highlight(title: string, query: string): React.ReactNode {
    if (!query) return title;
    const idx = title.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return title;
    return (
        <>
            {title.slice(0, idx)}
            <mark>{title.slice(idx, idx + query.length)}</mark>
            {title.slice(idx + query.length)}
        </>
    );
}

const RECENT_KEY = 'office-recent-pages';

export function getRecentPages(): { id: string; title: string; emoji: string; href: string }[] {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
}

export function trackRecentPage(entry: { id: string; title: string; emoji: string; href: string }) {
    const recent = getRecentPages().filter(r => r.id !== entry.id);
    recent.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 8)));
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter();
    const { workspace, pages, databases } = useOffice();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const [rowResults, setRowResults] = useState<SearchResult[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setSelected(0);
            setRowResults([]);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    // Server-side row search (debounced)
    useEffect(() => {
        if (!open || !workspace || query.trim().length < 2) {
            setRowResults([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?workspaceId=${workspace.id}&q=${encodeURIComponent(query.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    setRowResults((data.rows || []).map((r: { id: string; databaseId: string; title: string; isTaskDb: boolean }) => ({
                        id: r.id,
                        title: r.title,
                        emoji: r.isTaskDb ? '✅' : '🗂️',
                        href: r.isTaskDb ? `/w/${workspace.slug}/tasks` : `/w/${workspace.slug}/db/${r.databaseId}`,
                        group: r.isTaskDb ? 'Tasks' as const : 'Databases' as const,
                    })));
                }
            } catch {
                // search API unavailable; page results still shown
            }
        }, 250);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, open, workspace]);

    const results = useMemo((): SearchResult[] => {
        if (!workspace) return [];
        const q = query.trim();

        if (!q) {
            return getRecentPages().map(r => ({ ...r, group: 'Pages' as const }));
        }

        const pageResults = pages
            .map(p => ({ page: p, score: fuzzyScore(q, p.title) }))
            .filter(r => r.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map(r => ({
                id: r.page.id,
                title: r.page.title,
                emoji: r.page.iconEmoji || '📄',
                href: `/w/${workspace.slug}/page/${r.page.id}`,
                group: 'Pages' as const,
            }));

        const dbResults = databases
            .map(db => ({ db, score: fuzzyScore(q, db.title) }))
            .filter(r => r.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(r => ({
                id: r.db.id,
                title: r.db.title,
                emoji: r.db.iconEmoji || '🗂️',
                href: r.db.isTaskDb ? `/w/${workspace.slug}/tasks` : `/w/${workspace.slug}/db/${r.db.id}`,
                group: r.db.isTaskDb ? 'Tasks' as const : 'Databases' as const,
            }));

        return [...pageResults, ...dbResults, ...rowResults.slice(0, 8)];
    }, [query, pages, databases, workspace, rowResults]);

    const go = useCallback((result: SearchResult) => {
        onClose();
        router.push(result.href);
    }, [onClose, router]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected(s => Math.min(s + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected(s => Math.max(s - 1, 0));
        } else if (e.key === 'Enter' && results[selected]) {
            e.preventDefault();
            go(results[selected]);
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [results, selected, go, onClose]);

    if (!open) return null;

    const groups: Array<'Pages' | 'Databases' | 'Tasks'> = ['Pages', 'Databases', 'Tasks'];
    let flatIndex = -1;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.inputRow}>
                    <Search size={18} />
                    <input
                        ref={inputRef}
                        className={styles.input}
                        placeholder={`Search ${workspace?.name || 'workspace'}…`}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelected(0); }}
                        onKeyDown={onKeyDown}
                    />
                </div>
                <div className={styles.results}>
                    {results.length === 0 && (
                        <div className={styles.empty}>
                            {query ? 'No results found' : 'No recent pages — start typing to search'}
                        </div>
                    )}
                    {groups.map(group => {
                        const groupResults = results.filter(r => r.group === group);
                        if (groupResults.length === 0) return null;
                        return (
                            <div key={group}>
                                <div className={styles.groupLabel}>{query ? group : 'Recent'}</div>
                                {groupResults.map(result => {
                                    flatIndex++;
                                    const idx = results.indexOf(result);
                                    return (
                                        <button
                                            key={`${result.group}-${result.id}`}
                                            className={`${styles.result} ${idx === selected ? styles.selected : ''}`}
                                            onClick={() => go(result)}
                                            onMouseEnter={() => setSelected(idx)}
                                        >
                                            <span className={styles.resultIcon}>{result.emoji}</span>
                                            <span className={styles.resultTitle}>{highlight(result.title, query.trim())}</span>
                                            <span className={styles.resultType}>
                                                {group === 'Pages' ? <FileText size={12} /> : group === 'Tasks' ? <CheckSquare size={12} /> : <Table2 size={12} />}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
                <div className={styles.hint}>
                    <span><span className={styles.kbd}>↑↓</span> Navigate</span>
                    <span><span className={styles.kbd}>↵</span> Open</span>
                    <span><span className={styles.kbd}>Esc</span> Close</span>
                </div>
            </div>
        </div>
    );
}
