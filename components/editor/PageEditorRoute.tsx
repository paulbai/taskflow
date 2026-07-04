"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { FileX, ImagePlus, Smile, Trash2 } from 'lucide-react';
import type { Block, PageFull } from '@/lib/office-types';
import { useTopbar } from '@/components/office/TopbarState';
import { trackRecentPage } from '@/components/office/SearchModal';
import { usePresence } from '@/components/office/usePresence';
import { CommentsPanel } from '@/components/comments/CommentsPanel';
import { BlockEditor, makeBlock } from './BlockEditor';
import { EmojiPicker } from './EmojiPicker';
import styles from './PageEditorRoute.module.css';

function parseBlocks(content: string | null): Block[] {
    if (content) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed as Block[];
        } catch {
            // fall through to default
        }
    }
    return [makeBlock()];
}

export function PageEditorRoute() {
    const { workspaceSlug, pageId } = useParams<{ workspaceSlug: string; pageId: string }>();
    const { setCrumbs, setSaveStatus, setCommentCount } = useTopbar();

    const [page, setPage] = useState<PageFull | null>(null);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [remoteUpdate, setRemoteUpdate] = useState<string | null>(null);
    const lastKnownUpdateRef = useRef<string>('');
    const dirtyRef = useRef(false);

    // Live presence avatars in the topbar
    usePresence(page ? page.id : null);

    const titleRef = useRef('');
    const initialTitleRef = useRef('');
    const iconRef = useRef<string | null>(null);
    const blocksRef = useRef<Block[]>([]);
    blocksRef.current = blocks;

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<{ title?: string; content?: string }>({});
    const editorWrapRef = useRef<HTMLDivElement>(null);

    // ── Load page ───────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            setPage(null);
            try {
                const res = await fetch(`/api/pages/${pageId}`);
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (!cancelled) {
                        setError(
                            res.status === 404
                                ? 'This page does not exist or was deleted.'
                                : res.status === 403
                                    ? (data.error || 'You do not have access to this page.')
                                    : 'Something went wrong loading this page.'
                        );
                    }
                    return;
                }
                const p: PageFull = await res.json();
                if (cancelled) return;
                lastKnownUpdateRef.current = p.updatedAt;
                titleRef.current = p.title;
                initialTitleRef.current = p.title === 'Untitled' ? '' : p.title;
                iconRef.current = p.iconEmoji;
                setPage(p);
                setBlocks(parseBlocks(p.content));
                setCrumbs([{ label: p.title, emoji: p.iconEmoji }]);
                setCommentCount(p.comments.filter(c => !c.resolved).length);
                trackRecentPage({
                    id: p.id,
                    title: p.title,
                    emoji: p.iconEmoji || '📄',
                    href: `/w/${workspaceSlug}/page/${p.id}`,
                });
            } catch {
                if (!cancelled) setError('Something went wrong loading this page.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pageId, workspaceSlug, setCrumbs, setCommentCount]);

    // Reset topbar on unmount
    useEffect(() => {
        return () => {
            setCrumbs([]);
            setSaveStatus('');
            setCommentCount(0);
        };
    }, [setCrumbs, setSaveStatus, setCommentCount]);

    // ── Autosave (2s debounce) ──────────────────────────────────
    const flushSave = useCallback(async () => {
        const body = pendingRef.current;
        pendingRef.current = {};
        if (Object.keys(body).length === 0) return;
        try {
            const res = await fetch(`/api/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.updatedAt) lastKnownUpdateRef.current = data.updatedAt;
                dirtyRef.current = false;
            }
            setSaveStatus(res.ok ? 'saved' : '');
        } catch {
            setSaveStatus('');
        }
    }, [pageId, setSaveStatus]);

    const queueSave = useCallback((patch: { title?: string; content?: string }) => {
        pendingRef.current = { ...pendingRef.current, ...patch };
        dirtyRef.current = true;
        setSaveStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, 2000);
    }, [flushSave, setSaveStatus]);

    // ── Remote-change polling (5s) ──────────────────────────────
    useEffect(() => {
        if (!page) return;
        const interval = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const res = await fetch(`/api/pages/${page.id}`);
                if (!res.ok) return;
                const latest: PageFull = await res.json();
                if (
                    latest.updatedAt !== lastKnownUpdateRef.current &&
                    new Date(latest.updatedAt) > new Date(lastKnownUpdateRef.current) &&
                    !dirtyRef.current
                ) {
                    setRemoteUpdate(latest.updatedAt);
                }
            } catch {
                // offline — skip this poll
            }
        }, 5_000);
        return () => clearInterval(interval);
    }, [page]);

    const reloadPage = useCallback(() => {
        window.location.reload();
    }, []);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    // ── Change handlers ─────────────────────────────────────────
    const handleBlocksChange = useCallback((next: Block[]) => {
        setBlocks(next);
        queueSave({ content: JSON.stringify(next) });
    }, [queueSave]);

    const handleTitleInput = useCallback((e: React.FormEvent<HTMLHeadingElement>) => {
        const text = e.currentTarget.textContent || '';
        titleRef.current = text;
        setCrumbs([{ label: text.trim() || 'Untitled', emoji: iconRef.current }]);
        queueSave({ title: text.trim() || 'Untitled' });
    }, [queueSave, setCrumbs]);

    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const first = editorWrapRef.current?.querySelector<HTMLElement>('[data-block-id]');
            first?.focus();
        }
    }, []);

    const titleRefCb = useCallback((el: HTMLHeadingElement | null) => {
        if (el && el.textContent !== initialTitleRef.current) {
            el.textContent = initialTitleRef.current;
        }
    }, []);

    const patchMeta = useCallback(async (patch: { iconEmoji?: string | null; coverUrl?: string | null }) => {
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            setSaveStatus(res.ok ? 'saved' : '');
        } catch {
            setSaveStatus('');
        }
    }, [pageId, setSaveStatus]);

    const updateIcon = useCallback((emoji: string | null) => {
        iconRef.current = emoji;
        setPage(p => (p ? { ...p, iconEmoji: emoji } : p));
        setShowEmojiPicker(false);
        setCrumbs([{ label: titleRef.current.trim() || 'Untitled', emoji }]);
        patchMeta({ iconEmoji: emoji });
    }, [patchMeta, setCrumbs]);

    const updateCover = useCallback((url: string | null) => {
        setPage(p => (p ? { ...p, coverUrl: url } : p));
        patchMeta({ coverUrl: url });
    }, [patchMeta]);

    const promptForCover = useCallback(() => {
        const input = window.prompt('Cover image URL');
        if (!input) return;
        let url = input.trim();
        if (!url || /^javascript:/i.test(url)) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        updateCover(url);
    }, [updateCover]);

    // ── Render ──────────────────────────────────────────────────
    if (loading) {
        return (
            <div className={styles.centerState}>
                <div className={styles.spinner} aria-label="Loading page" />
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className={styles.centerState}>
                <FileX size={40} className={styles.errorIcon} />
                <h2 className={styles.errorTitle}>Cannot open this page</h2>
                <p className={styles.errorText}>{error || 'Unknown error.'}</p>
            </div>
        );
    }

    return (
        <div className={styles.page} key={page.id}>
            {page.coverUrl && (
                <div className={styles.coverWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.coverUrl} alt="" className={styles.cover} />
                    <div className={styles.coverActions}>
                        <button type="button" className={styles.coverBtn} onClick={promptForCover}>
                            Change
                        </button>
                        <button type="button" className={styles.coverBtn} onClick={() => updateCover(null)}>
                            <Trash2 size={13} /> Remove
                        </button>
                    </div>
                </div>
            )}

            <div className={clsx(styles.header, page.coverUrl && styles.headerWithCover)}>
                <div className={styles.iconRow}>
                    {page.iconEmoji ? (
                        <div className={styles.iconWrap}>
                            <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => setShowEmojiPicker(v => !v)}
                                aria-label="Change page icon"
                            >
                                {page.iconEmoji}
                            </button>
                            {showEmojiPicker && (
                                <EmojiPicker
                                    onSelect={updateIcon}
                                    onClose={() => setShowEmojiPicker(false)}
                                />
                            )}
                        </div>
                    ) : null}
                </div>

                <div className={styles.hoverActions}>
                    {!page.iconEmoji && (
                        <div className={styles.hoverActionWrap}>
                            <button
                                type="button"
                                className={styles.hoverActionBtn}
                                onClick={() => setShowEmojiPicker(v => !v)}
                            >
                                <Smile size={14} /> Add icon
                            </button>
                            {showEmojiPicker && (
                                <EmojiPicker
                                    onSelect={updateIcon}
                                    onClose={() => setShowEmojiPicker(false)}
                                />
                            )}
                        </div>
                    )}
                    {!page.coverUrl && (
                        <button type="button" className={styles.hoverActionBtn} onClick={promptForCover}>
                            <ImagePlus size={14} /> Add cover
                        </button>
                    )}
                </div>

                <h1
                    ref={titleRefCb}
                    className={styles.title}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck
                    data-placeholder="Untitled"
                    onInput={handleTitleInput}
                    onKeyDown={handleTitleKeyDown}
                />
            </div>

            <div ref={editorWrapRef} className={styles.editorWrap}>
                <BlockEditor
                    blocks={blocks}
                    onChange={handleBlocksChange}
                    workspaceSlug={workspaceSlug}
                />
            </div>

            {remoteUpdate && (
                <button
                    type="button"
                    onClick={reloadPage}
                    style={{
                        position: 'fixed', bottom: 88, right: 24, zIndex: 80,
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 18px', borderRadius: 'var(--radius-lg)',
                        border: 'none', background: 'var(--accent-gradient)', color: 'white',
                        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
                        cursor: 'pointer', boxShadow: '0 4px 20px var(--accent-glow)',
                    }}
                >
                    This page was updated by a teammate — click to reload
                </button>
            )}

            <CommentsPanel pageId={page.id} />
        </div>
    );
}
