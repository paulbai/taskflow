"use client";

import React, { useState } from 'react';
import styles from './TaskList.module.css';
import { TaskItem } from './TaskItem';
import { Task } from '../../types';
import { Share2, Plus, Copy, Check, Sparkles } from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '../providers/AppContext';

interface TaskListProps {
    tasks: Task[];
    onAddTask: (title: string) => Promise<void>;
    onToggleTask: (id: string) => Promise<void>;
    onUpdateTask: (task: Task) => Promise<void>;
    onDeleteTask: (id: string) => Promise<void>;
}

export function TaskList({ tasks, onAddTask, onToggleTask, onUpdateTask, onDeleteTask }: TaskListProps) {
    const [inputValue, setInputValue] = useState('');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSharePopup, setShowSharePopup] = useState(false);
    const [copied, setCopied] = useState(false);
    const { activeList } = useAppContext();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        await onAddTask(inputValue.trim());
        setInputValue('');
    };

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const handleCopyInvite = async () => {
        if (activeList?.inviteCode) {
            await navigator.clipboard.writeText(activeList.inviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const activeTasks = tasks.filter(t => t.status !== 'done');
    const completedTasks = tasks.filter(t => t.status === 'done');

    return (
        <div className={styles.container}>
            {/* List Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2 className={styles.listTitle}>{activeList?.name || 'Tasks'}</h2>
                    <span className={styles.taskCount}>
                        {activeTasks.length} active
                        {activeList?.isShared && ` · ${activeList.memberCount} members`}
                    </span>
                </div>
                <div style={{ position: 'relative' }}>
                    <button className={styles.shareBtn} onClick={() => setShowSharePopup(!showSharePopup)}>
                        <Share2 size={16} />
                    </button>
                    {showSharePopup && activeList?.inviteCode && (
                        <div className={styles.sharePopup}>
                            <p className={styles.shareLabel}>Share this invite code:</p>
                            <div className={styles.shareRow}>
                                <code className={styles.code}>{activeList.inviteCode}</code>
                                <button className={styles.copyBtn} onClick={handleCopyInvite}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Task Input */}
            <form onSubmit={handleSubmit} className={styles.inputForm}>
                <input
                    className={styles.input}
                    placeholder="What needs to be done?"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                <button type="submit" className={styles.addBtn} disabled={!inputValue.trim()}>
                    <Plus size={20} />
                </button>
            </form>

            {/* Tasks */}
            <div className={styles.list}>
                <AnimatePresence mode="popLayout">
                    {activeTasks.map((task, index) => (
                        <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, x: -20 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <TaskItem task={task} index={index} onToggle={onToggleTask} onClick={handleTaskClick} />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {activeTasks.length === 0 && (
                    <motion.div
                        className={styles.emptyState}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Sparkles size={40} className={styles.emptyIcon} />
                        <p className={styles.emptyText}>All clear! Time to relax.</p>
                    </motion.div>
                )}

                {completedTasks.length > 0 && (
                    <div className={styles.completedSection}>
                        <h3 className={styles.completedTitle}>Completed ({completedTasks.length})</h3>
                        <AnimatePresence mode="popLayout">
                            {completedTasks.map((task, index) => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.6 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <TaskItem task={task} index={index} onToggle={onToggleTask} onClick={handleTaskClick} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={selectedTask}
                onSave={onUpdateTask}
                onDelete={onDeleteTask}
            />
        </div>
    );
}
