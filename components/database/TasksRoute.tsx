"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { DbColumn } from '@/lib/office-types';
import { useOffice } from '@/components/office/OfficeContext';
import { DatabaseView } from './DatabaseView';
import { uid } from './db-utils';
import styles from './DatabaseView.module.css';

function buildTaskSchema(): DbColumn[] {
    return [
        { id: uid(), name: 'Title', type: 'text' },
        {
            id: uid(),
            name: 'Status',
            type: 'select',
            options: [
                { id: uid(), label: 'To Do', color: 'orange' },
                { id: uid(), label: 'In Progress', color: 'blue' },
                { id: uid(), label: 'Done', color: 'teal' },
            ],
        },
        { id: uid(), name: 'Assignee', type: 'person' },
        { id: uid(), name: 'Due Date', type: 'date' },
        {
            id: uid(),
            name: 'Priority',
            type: 'select',
            options: [
                { id: uid(), label: 'Low', color: 'blue' },
                { id: uid(), label: 'Medium', color: 'yellow' },
                { id: uid(), label: 'High', color: 'orange' },
                { id: uid(), label: 'Urgent', color: 'coral' },
            ],
        },
    ];
}

export function TasksRoute() {
    const { workspace, databases, loading, refreshDatabases } = useOffice();
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const creatingRef = useRef(false);

    const taskDb = databases.find(d => d.isTaskDb);

    useEffect(() => {
        if (loading || !workspace || taskDb || creatingRef.current) return;
        creatingRef.current = true;
        setCreating(true);
        (async () => {
            try {
                const res = await fetch('/api/databases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspaceId: workspace.id,
                        title: 'Tasks',
                        iconEmoji: '✅',
                        schema: buildTaskSchema(),
                        defaultView: 'board',
                        isTaskDb: true,
                    }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || 'Failed to create the task database');
                }
                await refreshDatabases();
            } catch (e) {
                setCreateError(e instanceof Error ? e.message : 'Failed to create the task database');
            } finally {
                setCreating(false);
            }
        })();
    }, [loading, workspace, taskDb, refreshDatabases]);

    if (createError) {
        return (
            <div className={styles.state}>
                <div className={styles.stateEmoji}>🚧</div>
                <div className={styles.stateTitle}>Couldn&apos;t set up your task board</div>
                {createError}
            </div>
        );
    }

    if (!taskDb) {
        return (
            <div className={styles.state}>
                <div className={styles.stateEmoji}>✅</div>
                {creating ? 'Setting up your task board…' : 'Loading tasks…'}
            </div>
        );
    }

    return <DatabaseView key={taskDb.id} databaseId={taskDb.id} fallbackView="board" />;
}
