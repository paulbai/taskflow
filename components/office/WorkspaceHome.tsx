"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Clock, CheckSquare, Activity, FilePlus, Table2, ListTodo } from 'lucide-react';
import styles from './WorkspaceHome.module.css';
import { useOffice } from './OfficeContext';
import { useTopbar } from './TopbarState';
import { getRecentPages } from './SearchModal';
import type { DbColumn, DbRow } from '@/lib/office-types';

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function WorkspaceHome() {
    const router = useRouter();
    const { data: session } = useSession();
    const { workspace, pages, databases, createPage, currentUserId } = useOffice();
    const { setCrumbs, setCommentCount } = useTopbar();
    const [recent, setRecent] = useState<{ id: string; title: string; emoji: string; href: string }[]>([]);
    const [myTasks, setMyTasks] = useState<{ id: string; title: string; due: string | null; href: string }[]>([]);

    useEffect(() => {
        setCrumbs([{ label: 'Home' }]);
        setCommentCount(0);
    }, [setCrumbs, setCommentCount]);

    useEffect(() => {
        setRecent(getRecentPages().slice(0, 5));
    }, []);

    // Load "my open tasks" from the workspace's task database (if it exists)
    const loadMyTasks = useCallback(async () => {
        if (!workspace) return;
        const taskDb = databases.find(db => db.isTaskDb);
        if (!taskDb) { setMyTasks([]); return; }

        try {
            const [dbRes, rowsRes] = await Promise.all([
                fetch(`/api/databases/${taskDb.id}`),
                fetch(`/api/databases/${taskDb.id}/rows`),
            ]);
            if (!dbRes.ok || !rowsRes.ok) return;
            const dbFull = await dbRes.json();
            const rows: DbRow[] = await rowsRes.json();

            const schema: DbColumn[] = dbFull.schema || [];
            const titleCol = schema.find(c => c.type === 'text');
            const statusCol = schema.find(c => c.name.toLowerCase() === 'status');
            const assigneeCol = schema.find(c => c.type === 'person');
            const dateCol = schema.find(c => c.type === 'date');
            if (!titleCol) return;

            const doneOption = statusCol?.options?.find(o => o.label.toLowerCase() === 'done');

            const mine = rows.filter(row => {
                const assignee = assigneeCol ? row.data[assigneeCol.id] : null;
                const status = statusCol ? row.data[statusCol.id] : null;
                const isMine = assignee === currentUserId;
                const isDone = doneOption ? status === doneOption.id : false;
                return isMine && !isDone;
            }).slice(0, 5);

            setMyTasks(mine.map(row => ({
                id: row.id,
                title: String(row.data[titleCol.id] || 'Untitled'),
                due: dateCol ? (row.data[dateCol.id] as string | null) : null,
                href: `/w/${workspace.slug}/tasks`,
            })));
        } catch {
            // task db unavailable
        }
    }, [workspace, databases, currentUserId]);

    useEffect(() => {
        loadMyTasks();
    }, [loadMyTasks]);

    // Team activity: recently updated pages
    const activity = useMemo(() => {
        return [...pages]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10);
    }, [pages]);

    if (!workspace) return null;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = (session?.user?.name || 'there').split(' ')[0];

    const createTaskDb = async () => {
        const existing = databases.find(db => db.isTaskDb);
        if (existing) { router.push(`/w/${workspace.slug}/tasks`); return; }
        router.push(`/w/${workspace.slug}/tasks`);
    };

    const createDatabase = async () => {
        const res = await fetch('/api/databases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspaceId: workspace.id,
                title: 'New database',
                schema: [
                    { id: crypto.randomUUID(), name: 'Name', type: 'text' },
                    {
                        id: crypto.randomUUID(), name: 'Status', type: 'select', options: [
                            { id: crypto.randomUUID(), label: 'Not started', color: 'orange' },
                            { id: crypto.randomUUID(), label: 'In progress', color: 'blue' },
                            { id: crypto.randomUUID(), label: 'Done', color: 'teal' },
                        ],
                    },
                ],
            }),
        });
        if (res.ok) {
            const db = await res.json();
            router.push(`/w/${workspace.slug}/db/${db.id}`);
        }
    };

    return (
        <div className={styles.home}>
            <div>
                <div className={styles.greeting}>{greeting}, {firstName} 👋</div>
                <div className={styles.greetingSub}>
                    Here&apos;s what&apos;s happening in {workspace.name}
                </div>
            </div>

            <div className={styles.quickRow}>
                <button className={styles.quickBtn} onClick={() => createPage()}>
                    <FilePlus size={16} /> New page
                </button>
                <button className={styles.quickBtn} onClick={createTaskDb}>
                    <ListTodo size={16} /> New task
                </button>
                <button className={styles.quickBtn} onClick={createDatabase}>
                    <Table2 size={16} /> New database
                </button>
            </div>

            {recent.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <Clock size={16} /> Recently visited
                    </div>
                    <div className={styles.cardRow}>
                        {recent.map(r => (
                            <button key={r.id} className={styles.pageCard} onClick={() => router.push(r.href)}>
                                <span className={styles.pageCardEmoji}>{r.emoji}</span>
                                <span className={styles.pageCardTitle}>{r.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.section}>
                <div className={styles.sectionTitle}>
                    <CheckSquare size={16} /> My open tasks
                    <button className={styles.viewAll} onClick={() => router.push(`/w/${workspace.slug}/tasks`)}>
                        View all
                    </button>
                </div>
                {myTasks.length === 0 ? (
                    <div className={styles.empty}>No open tasks assigned to you 🎉</div>
                ) : (
                    <div className={styles.taskList}>
                        {myTasks.map(task => (
                            <button key={task.id} className={styles.taskRow} onClick={() => router.push(task.href)}>
                                <span className={styles.taskTitle}>{task.title}</span>
                                {task.due && <span className={styles.taskMeta}>Due {task.due}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionTitle}>
                    <Activity size={16} /> Team activity
                </div>
                {activity.length === 0 ? (
                    <div className={styles.empty}>No pages yet — create the first one!</div>
                ) : (
                    <div className={styles.activityList}>
                        {activity.map(page => (
                            <button
                                key={page.id}
                                className={styles.activityRow}
                                onClick={() => router.push(`/w/${workspace.slug}/page/${page.id}`)}
                            >
                                <span className={styles.activityEmoji}>{page.iconEmoji || '📄'}</span>
                                <span className={styles.activityText}>
                                    <strong>{page.title}</strong> was updated
                                </span>
                                <span className={styles.activityTime}>{timeAgo(page.updatedAt)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
