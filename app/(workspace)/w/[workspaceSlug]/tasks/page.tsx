"use client";

import dynamic from 'next/dynamic';

// The task board is a heavy, purely client-side component
const TasksRoute = dynamic(
    () => import('@/components/database/TasksRoute').then(m => m.TasksRoute),
    { ssr: false }
);

export default function TasksPage() {
    return <TasksRoute />;
}
