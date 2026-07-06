"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Clock, Activity, FilePlus, Table2, ListTodo,
    Home, CheckSquare, User, Plus,
} from 'lucide-react';
import clsx from 'clsx';
import styles from './WorkspaceHome.module.css';
import { useOffice } from './OfficeContext';
import { useTopbar } from './TopbarState';
import { getRecentPages } from './SearchModal';
import { DatabaseView } from '@/components/database/DatabaseView';

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

type HqTab = 'overview' | 'company' | 'mine';

export function WorkspaceHome() {
    const router = useRouter();
    const { data: session } = useSession();
    const { workspace, pages, databases, createPage, currentUserId } = useOffice();
    const { setCrumbs, setCommentCount } = useTopbar();
    const [tab, setTab] = useState<HqTab>('overview');
    const [recent, setRecent] = useState<{ id: string; title: string; emoji: string; href: string }[]>([]);

    const taskDb = databases.find(db => db.isTaskDb);

    useEffect(() => {
        setCrumbs([{ label: 'Home' }]);
        setCommentCount(0);
    }, [setCrumbs, setCommentCount]);

    useEffect(() => {
        setRecent(getRecentPages().slice(0, 5));
        const stored = localStorage.getItem('hq-tab') as HqTab | null;
        if (stored === 'overview' || stored === 'company' || stored === 'mine') setTab(stored);
    }, []);

    const switchTab = useCallback((next: HqTab) => {
        setTab(next);
        localStorage.setItem('hq-tab', next);
    }, []);

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
            <div className={styles.hqHeader}>
                <span className={styles.hqIcon}>{workspace.iconEmoji}</span>
                <div>
                    <div className={styles.hqName}>{workspace.name}</div>
                    <div className={styles.hqSub}>
                        {greeting}, {firstName} 👋 · {workspace.members.length} member{workspace.members.length === 1 ? '' : 's'}
                    </div>
                </div>
            </div>

            <div>
                <div className={styles.hqTabs}>
                    <button className={clsx(styles.hqTab, tab === 'overview' && styles.hqTabActive)} onClick={() => switchTab('overview')}>
                        <Home size={14} /> Overview
                    </button>
                    <button className={clsx(styles.hqTab, tab === 'company' && styles.hqTabActive)} onClick={() => switchTab('company')}>
                        <CheckSquare size={14} /> Company tasks
                    </button>
                    <button className={clsx(styles.hqTab, tab === 'mine' && styles.hqTabActive)} onClick={() => switchTab('mine')}>
                        <User size={14} /> My tasks
                    </button>
                    <button className={styles.hqNewBtn} onClick={() => router.push(`/w/${workspace.slug}/tasks`)}>
                        <Plus size={14} /> New task
                    </button>
                </div>

                {tab === 'company' && (
                    taskDb ? (
                        <DatabaseView key={taskDb.id} databaseId={taskDb.id} embedded fallbackView="board" />
                    ) : (
                        <div className={styles.empty}>
                            No task board yet —{' '}
                            <button className={styles.viewAll} onClick={() => router.push(`/w/${workspace.slug}/tasks`)}>
                                set it up in one click
                            </button>
                        </div>
                    )
                )}

                {tab === 'mine' && (
                    taskDb ? (
                        <DatabaseView
                            key={`${taskDb.id}-mine`}
                            databaseId={taskDb.id}
                            embedded
                            fallbackView="table"
                            assigneeFilter={currentUserId}
                        />
                    ) : (
                        <div className={styles.empty}>
                            No task board yet —{' '}
                            <button className={styles.viewAll} onClick={() => router.push(`/w/${workspace.slug}/tasks`)}>
                                set it up in one click
                            </button>
                        </div>
                    )
                )}

                {tab === 'overview' && (
                    <div className={styles.home}>
                        <div className={styles.quickRow}>
                            <button className={styles.quickBtn} onClick={() => createPage()}>
                                <FilePlus size={16} /> New page
                            </button>
                            <button className={styles.quickBtn} onClick={() => router.push(`/w/${workspace.slug}/tasks`)}>
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
                )}
            </div>
        </div>
    );
}
