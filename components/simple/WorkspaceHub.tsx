"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Plus, UserPlus, ExternalLink, Users } from 'lucide-react';
import styles from './WorkspaceHub.module.css';

interface WorkspaceSummary {
    id: string;
    name: string;
    slug: string | null;
    iconEmoji: string;
    isOwner: boolean;
    myRole: string;
    memberCount: number;
    taskDatabaseId: string | null;
    taskCount: number;
    statusOptions: { id: string; label: string; color: string }[];
}

interface SimpleTask {
    rowId: string;
    title: string;
    assignee: string;
    statusId: string;
    bucket: 'todo' | 'in_progress' | 'done';
}

const COLOR_VAR: Record<string, string> = {
    orange: 'var(--card-orange)',
    yellow: 'var(--card-yellow)',
    blue: 'var(--card-blue)',
    coral: 'var(--card-coral)',
    purple: 'var(--card-purple)',
    teal: 'var(--card-teal)',
};
const colorOf = (c: string) => COLOR_VAR[c] || 'var(--card-orange)';

function bucketOf(label: string): 'todo' | 'in_progress' | 'done' {
    const l = (label || '').toLowerCase();
    if (/(done|closed|complete|shipped)/.test(l)) return 'done';
    if (/(progress|ongoing|doing|active|review|pending)/.test(l)) return 'in_progress';
    return 'todo';
}

const COLUMNS: { key: 'todo' | 'in_progress' | 'done'; label: string; color: string }[] = [
    { key: 'todo', label: 'To Do', color: 'var(--card-orange)' },
    { key: 'in_progress', label: 'In Progress', color: 'var(--card-blue)' },
    { key: 'done', label: 'Done', color: 'var(--accent)' },
];

export function WorkspaceHub({ onNeedsRefresh }: { onNeedsRefresh?: () => void }) {
    const router = useRouter();
    const { data: session } = useSession();
    const myName = (session?.user?.name || '').toLowerCase();

    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<WorkspaceSummary | null>(null);
    const [tasks, setTasks] = useState<SimpleTask[]>([]);
    const [boardLoading, setBoardLoading] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const loadWorkspaces = useCallback(async () => {
        try {
            const res = await fetch('/api/my-workspaces');
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data.workspaces || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

    const loadBoard = useCallback(async (ws: WorkspaceSummary) => {
        if (!ws.taskDatabaseId) { setTasks([]); return; }
        setBoardLoading(true);
        try {
            const [dbRes, rowsRes] = await Promise.all([
                fetch(`/api/databases/${ws.taskDatabaseId}`),
                fetch(`/api/databases/${ws.taskDatabaseId}/rows`),
            ]);
            if (!dbRes.ok || !rowsRes.ok) { setTasks([]); return; }
            const db = await dbRes.json();
            const rows = await rowsRes.json();
            const schema = db.schema || [];
            const titleCol = schema.find((c: { type: string }) => c.type === 'text');
            const statusCol = schema.find((c: { type: string; name: string }) => c.type === 'select' && /status/i.test(c.name))
                || schema.find((c: { type: string }) => c.type === 'select');
            const assigneeCol = schema.find((c: { type: string; name: string }) => c.type === 'person' || /assign|owner|who/i.test(c.name));

            const opts: Record<string, string> = {};
            (statusCol?.options || []).forEach((o: { id: string; label: string }) => { opts[o.id] = o.label; });

            setTasks(rows.map((r: { id: string; data: Record<string, unknown> }) => {
                const statusId = String(r.data[statusCol?.id] || '');
                return {
                    rowId: r.id,
                    title: String(r.data[titleCol?.id] || 'Untitled'),
                    assignee: assigneeCol ? String(r.data[assigneeCol.id] || '') : '',
                    statusId,
                    bucket: bucketOf(opts[statusId] || ''),
                };
            }));
        } finally {
            setBoardLoading(false);
        }
    }, []);

    const openWorkspace = useCallback((ws: WorkspaceSummary) => {
        setActive(ws);
        loadBoard(ws);
    }, [loadBoard]);

    const move = useCallback(async (task: SimpleTask, optionId: string) => {
        if (!active) return;
        setOpenMenu(null);
        // optimistic
        const label = active.statusOptions.find(o => o.id === optionId)?.label || '';
        setTasks(prev => prev.map(t =>
            t.rowId === task.rowId ? { ...t, statusId: optionId, bucket: bucketOf(label) } : t,
        ));
        await fetch('/api/my-tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowId: task.rowId, statusOptionId: optionId }),
        });
        onNeedsRefresh?.();
    }, [active, onNeedsRefresh]);

    const grouped = useMemo(() => ({
        todo: tasks.filter(t => t.bucket === 'todo'),
        in_progress: tasks.filter(t => t.bucket === 'in_progress'),
        done: tasks.filter(t => t.bucket === 'done'),
    }), [tasks]);

    // ── Board view for one workspace ──
    if (active) {
        return (
            <div className={styles.wrap}>
                <div className={styles.header}>
                    <button className={styles.ghostBtn} onClick={() => { setActive(null); setTasks([]); }}>
                        <ArrowLeft size={16} /> Back
                    </button>
                    <span className={styles.title}>{active.iconEmoji} {active.name}</span>
                    <div className={styles.headerActions}>
                        {active.slug && (
                            <button className={styles.ghostBtn} onClick={() => router.push(`/w/${active.slug}`)}>
                                <ExternalLink size={15} /> Full workspace
                            </button>
                        )}
                    </div>
                </div>

                {boardLoading ? (
                    <div className={styles.state}>Loading tasks…</div>
                ) : !active.taskDatabaseId ? (
                    <div className={styles.state}>
                        <div className={styles.stateEmoji}>✅</div>
                        No task board yet in this workspace.
                    </div>
                ) : (
                    <div className={styles.board}>
                        {COLUMNS.map(col => (
                            <div key={col.key} className={styles.col}>
                                <div className={styles.colHead}>
                                    <span className={styles.colDot} style={{ background: col.color }} />
                                    <span className={styles.colName}>{col.label}</span>
                                    <span className={styles.colCount}>{grouped[col.key].length}</span>
                                </div>
                                <div className={styles.cards}>
                                    {grouped[col.key].length === 0 && (
                                        <div className={styles.emptyCol}>Nothing here</div>
                                    )}
                                    {grouped[col.key].map(task => {
                                        const isMine = Boolean(
                                            myName && task.assignee &&
                                            task.assignee.toLowerCase().includes(myName.split(' ')[0]),
                                        );
                                        return (
                                            <button
                                                key={task.rowId}
                                                className={styles.taskCard}
                                                onClick={() => setOpenMenu(openMenu === task.rowId ? null : task.rowId)}
                                            >
                                                <div className={styles.taskTitle}>{task.title}</div>
                                                {(task.assignee || isMine) && (
                                                    <div className={styles.taskMeta}>
                                                        {task.assignee && (
                                                            <>
                                                                <span className={styles.avatar}>
                                                                    {task.assignee.charAt(0).toUpperCase()}
                                                                </span>
                                                                {task.assignee}
                                                            </>
                                                        )}
                                                        {isMine && <span className={styles.mine}>You</span>}
                                                    </div>
                                                )}

                                                {openMenu === task.rowId && (
                                                    <>
                                                        <span className={styles.backdrop} onClick={e => { e.stopPropagation(); setOpenMenu(null); }} />
                                                        <span className={styles.moveMenu}>
                                                            {active.statusOptions.map(opt => (
                                                                <span
                                                                    key={opt.id}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    className={styles.moveItem}
                                                                    onClick={e => { e.stopPropagation(); move(task, opt.id); }}
                                                                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); move(task, opt.id); } }}
                                                                >
                                                                    <span className={styles.colDot} style={{ background: colorOf(opt.color) }} />
                                                                    Move to {opt.label}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ── Workspace list ──
    return (
        <div className={styles.wrap}>
            <div className={styles.header}>
                <span className={styles.title}>Workspaces</span>
                <div className={styles.headerActions}>
                    <button className={styles.ghostBtn} onClick={() => router.push('/w')}>
                        <UserPlus size={15} /> Join
                    </button>
                    <button className={styles.primaryBtn} onClick={() => router.push('/w')}>
                        <Plus size={15} /> New
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={styles.state}>Loading workspaces…</div>
            ) : workspaces.length === 0 ? (
                <div className={styles.state}>
                    <div className={styles.stateEmoji}>🏢</div>
                    You&apos;re not in any workspace yet.
                </div>
            ) : (
                <div className={styles.grid}>
                    {workspaces.map(ws => (
                        <button key={ws.id} className={styles.wsCard} onClick={() => openWorkspace(ws)}>
                            <div className={styles.wsTop}>
                                <span className={styles.wsIcon}>{ws.iconEmoji}</span>
                                <div>
                                    <div className={styles.wsName}>{ws.name}</div>
                                    <div className={styles.wsMeta}>
                                        <Users size={12} style={{ verticalAlign: -1 }} />{' '}
                                        {ws.memberCount} member{ws.memberCount === 1 ? '' : 's'}
                                        {ws.isOwner && ' · owner'}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.wsStats}>
                                <div className={styles.pill}>
                                    <div className={styles.pillNum}>{ws.taskCount}</div>
                                    <div className={styles.pillLabel}>Tasks</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
