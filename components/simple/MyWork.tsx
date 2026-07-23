"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, ChevronDown, Check } from 'lucide-react';
import styles from './MyWork.module.css';

export interface MyTask {
    rowId: string;
    databaseId: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string | null;
    workspaceIcon: string;
    title: string;
    statusLabel: string;
    statusColor: string;
    bucket: 'todo' | 'in_progress' | 'done';
    statusColumnId: string;
    statusOptions: { id: string; label: string; color: string }[];
    dueDate: string | null;
    updatedAt: string;
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

function formatDue(iso: string | null): { text: string; soon: boolean } | null {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    const text = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    if (days < 0) return { text: `${text} · overdue`, soon: true };
    if (days === 0) return { text: 'Due today', soon: true };
    if (days <= 3) return { text: `${text} · in ${days}d`, soon: true };
    return { text, soon: false };
}

export function MyWork({
    tasks,
    onChanged,
}: {
    tasks: MyTask[];
    onChanged: () => void;
}) {
    const router = useRouter();
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);

    const move = useCallback(async (task: MyTask, optionId: string) => {
        setOpenMenu(null);
        setSaving(task.rowId);
        try {
            await fetch('/api/my-tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowId: task.rowId, statusOptionId: optionId }),
            });
            onChanged();
        } finally {
            setSaving(null);
        }
    }, [onChanged]);

    // Group by workspace so it reads like "here's my work, per team"
    const groups = useMemo(() => {
        const map = new Map<string, { name: string; icon: string; slug: string | null; items: MyTask[] }>();
        for (const t of tasks) {
            const g = map.get(t.workspaceId) || {
                name: t.workspaceName,
                icon: t.workspaceIcon,
                slug: t.workspaceSlug,
                items: [],
            };
            g.items.push(t);
            map.set(t.workspaceId, g);
        }
        return Array.from(map.entries());
    }, [tasks]);

    if (tasks.length === 0) {
        return (
            <div className={styles.section}>
                <div className={styles.header}>
                    <Briefcase size={18} color="var(--text-tertiary)" />
                    <span className={styles.title}>My work</span>
                </div>
                <div className={styles.empty}>
                    No workspace tasks assigned to you yet.
                </div>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <Briefcase size={18} color="var(--text-tertiary)" />
                <span className={styles.title}>My work</span>
                <span className={styles.count}>{tasks.length}</span>
            </div>

            <div className={styles.list}>
                {groups.map(([wsId, g]) => (
                    <React.Fragment key={wsId}>
                        <div className={styles.groupLabel}>
                            <span>{g.icon}</span>
                            {g.name}
                            {g.slug && (
                                <button
                                    className={styles.openWs}
                                    onClick={() => router.push(`/w/${g.slug}`)}
                                >
                                    Open workspace →
                                </button>
                            )}
                        </div>

                        {g.items.map(task => {
                            const due = formatDue(task.dueDate);
                            const isOpen = openMenu === task.rowId;
                            return (
                                <div key={task.rowId} className={styles.card}>
                                    <div className={styles.cardBody}>
                                        <div
                                            className={`${styles.cardTitle} ${task.bucket === 'done' ? styles.cardTitleDone : ''}`}
                                            title={task.title}
                                        >
                                            {task.title}
                                        </div>
                                        {due && (
                                            <div className={styles.cardMeta}>
                                                <span className={`${styles.due} ${due.soon ? styles.dueSoon : ''}`}>
                                                    {due.text}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.statusWrap}>
                                        <button
                                            className={styles.statusPill}
                                            onClick={() => setOpenMenu(isOpen ? null : task.rowId)}
                                            disabled={saving === task.rowId}
                                        >
                                            <span
                                                className={styles.dot}
                                                style={{ background: colorOf(task.statusColor) }}
                                            />
                                            {saving === task.rowId ? 'Saving…' : task.statusLabel}
                                            <ChevronDown size={14} />
                                        </button>

                                        {isOpen && (
                                            <>
                                                <div className={styles.backdrop} onClick={() => setOpenMenu(null)} />
                                                <div className={styles.menu}>
                                                    {task.statusOptions.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            className={`${styles.menuItem} ${opt.label === task.statusLabel ? styles.menuItemActive : ''}`}
                                                            onClick={() => move(task, opt.id)}
                                                        >
                                                            <span
                                                                className={styles.dot}
                                                                style={{ background: colorOf(opt.color) }}
                                                            />
                                                            {opt.label}
                                                            {opt.label === task.statusLabel && (
                                                                <Check size={14} style={{ marginLeft: 'auto' }} />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
