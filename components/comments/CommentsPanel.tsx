"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Send, Check, RotateCcw, Trash2, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import styles from './CommentsPanel.module.css';
import { useOffice } from '@/components/office/OfficeContext';
import { useTopbar } from '@/components/office/TopbarState';
import type { PageComment } from '@/lib/office-types';

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

/** Render comment text with highlighted @mentions. */
function renderContent(text: string): React.ReactNode {
    const parts = text.split(/(@[\w.-]+(?:\s[\w.-]+)?)/g);
    return parts.map((part, i) =>
        part.startsWith('@') ? <mark key={i}>{part}</mark> : part
    );
}

export function CommentsPanel({ pageId }: { pageId: string }) {
    const { workspace, currentUserId } = useOffice();
    const { commentsOpen, setCommentsOpen, setCommentCount } = useTopbar();
    const [comments, setComments] = useState<PageComment[]>([]);
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState<PageComment | null>(null);
    const [busy, setBusy] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/comments?pageId=${pageId}`);
            if (res.ok) {
                const data: PageComment[] = await res.json();
                setComments(data);
                setCommentCount(data.filter(c => !c.resolved && !c.parentId).length);
            }
        } catch {
            // keep stale data
        }
    }, [pageId, setCommentCount]);

    useEffect(() => {
        load();
    }, [load]);

    const threads = useMemo(() => comments.filter(c => !c.parentId), [comments]);
    const repliesOf = useCallback(
        (id: string) => comments.filter(c => c.parentId === id),
        [comments]
    );

    const members = workspace?.members || [];
    const mentionCandidates = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
    }, [mentionQuery, members]);

    const onInputChange = useCallback((value: string) => {
        setInput(value);
        const caretText = value.slice(0, inputRef.current?.selectionStart ?? value.length);
        const match = caretText.match(/@([\w.-]*)$/);
        setMentionQuery(match ? match[1] : null);
        setMentionIndex(0);
    }, []);

    const insertMention = useCallback((name: string) => {
        setInput(prev => prev.replace(/@([\w.-]*)$/, `@${name} `));
        setMentionQuery(null);
        inputRef.current?.focus();
    }, []);

    const submit = useCallback(async () => {
        const content = input.trim();
        if (!content || busy) return;
        setBusy(true);
        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId, content, parentId: replyTo?.id || null }),
            });
            if (res.ok) {
                setInput('');
                setReplyTo(null);
                await load();
            }
        } finally {
            setBusy(false);
        }
    }, [input, busy, pageId, replyTo, load]);

    const toggleResolve = useCallback(async (comment: PageComment) => {
        await fetch(`/api/comments/${comment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolved: !comment.resolved }),
        });
        await load();
    }, [load]);

    const remove = useCallback(async (comment: PageComment) => {
        await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
        await load();
    }, [load]);

    if (!commentsOpen) return null;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Comments</span>
                <button className={styles.closeBtn} onClick={() => setCommentsOpen(false)} aria-label="Close comments">
                    <X size={16} />
                </button>
            </div>

            <div className={styles.list}>
                {threads.length === 0 && (
                    <div className={styles.empty}>
                        <MessageSquare size={24} />
                        <span>No comments yet.<br />Start the conversation!</span>
                    </div>
                )}
                {threads.map(thread => (
                    <div key={thread.id} className={clsx(styles.thread, thread.resolved && styles.resolved)}>
                        <div className={styles.comment}>
                            <span className={styles.avatar}>{thread.user.name.charAt(0).toUpperCase()}</span>
                            <div className={styles.commentBody}>
                                <div className={styles.commentMeta}>
                                    <span className={styles.commentAuthor}>{thread.user.name}</span>
                                    <span className={styles.commentTime}>{timeAgo(thread.createdAt)}</span>
                                </div>
                                <div className={styles.commentText}>{renderContent(thread.content)}</div>
                            </div>
                        </div>

                        {repliesOf(thread.id).map(reply => (
                            <div key={reply.id} className={clsx(styles.comment, styles.reply)}>
                                <span className={styles.avatar}>{reply.user.name.charAt(0).toUpperCase()}</span>
                                <div className={styles.commentBody}>
                                    <div className={styles.commentMeta}>
                                        <span className={styles.commentAuthor}>{reply.user.name}</span>
                                        <span className={styles.commentTime}>{timeAgo(reply.createdAt)}</span>
                                    </div>
                                    <div className={styles.commentText}>{renderContent(reply.content)}</div>
                                </div>
                            </div>
                        ))}

                        <div className={styles.threadActions}>
                            <button className={styles.threadBtn} onClick={() => { setReplyTo(thread); inputRef.current?.focus(); }}>
                                Reply
                            </button>
                            <button className={styles.threadBtn} onClick={() => toggleResolve(thread)}>
                                {thread.resolved ? <><RotateCcw size={11} /> Reopen</> : <><Check size={11} /> Resolve</>}
                            </button>
                            {thread.user.id === currentUserId && (
                                <button className={styles.threadBtn} onClick={() => remove(thread)}>
                                    <Trash2 size={11} /> Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.inputArea}>
                {mentionCandidates.length > 0 && (
                    <div className={styles.mentionMenu}>
                        {mentionCandidates.map((m, i) => (
                            <button
                                key={m.userId}
                                className={clsx(styles.mentionItem, i === mentionIndex && styles.selected)}
                                onClick={() => insertMention(m.name)}
                            >
                                <span className={styles.avatar}>{m.name.charAt(0).toUpperCase()}</span>
                                {m.name}
                            </button>
                        ))}
                    </div>
                )}
                {replyTo && (
                    <div className={styles.replyingTo}>
                        Replying to {replyTo.user.name}
                        <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                            <X size={12} />
                        </button>
                    </div>
                )}
                <div className={styles.inputRow}>
                    <textarea
                        ref={inputRef}
                        className={styles.input}
                        rows={1}
                        placeholder="Comment… use @ to mention"
                        value={input}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={e => {
                            if (mentionCandidates.length > 0) {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1));
                                    return;
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setMentionIndex(i => Math.max(i - 1, 0));
                                    return;
                                }
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault();
                                    insertMention(mentionCandidates[mentionIndex].name);
                                    return;
                                }
                                if (e.key === 'Escape') {
                                    setMentionQuery(null);
                                    return;
                                }
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                    />
                    <button className={styles.sendBtn} onClick={submit} disabled={busy || !input.trim()} aria-label="Send comment">
                        <Send size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
