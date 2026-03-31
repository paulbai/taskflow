"use client";

import React, { useState } from 'react';
import styles from './KanbanBoard.module.css';
import { Task, TaskStatus, WorkspaceMember } from '@/types';
import { Plus, Calendar, User, ChevronRight, Clock, GripVertical, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface KanbanBoardProps {
    tasks: Task[];
    members: WorkspaceMember[];
    boardInviteCode?: string;
    onAddTask: (data: { title: string; description?: string; priority?: string; startDate?: string; dueDate?: string; assigneeName?: string }) => Promise<void>;
    onUpdateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
    onTaskClick: (task: Task) => void;
}

const STATUS_CONFIG: { key: TaskStatus; label: string; color: string; bg: string }[] = [
    { key: 'todo', label: 'To Do', color: '#f5a623', bg: 'rgba(245, 166, 35, 0.08)' },
    { key: 'in_progress', label: 'In Progress', color: '#5b8def', bg: 'rgba(91, 141, 239, 0.08)' },
    { key: 'done', label: 'Done', color: '#4c8c4a', bg: 'rgba(76, 140, 74, 0.08)' },
];

const PRIORITY_COLORS: Record<string, string> = {
    high: '#f06868',
    medium: '#f5a623',
    low: '#5b8def',
    none: 'transparent',
};

export function KanbanBoard({ tasks, members, boardInviteCode, onAddTask, onUpdateTaskStatus, onTaskClick }: KanbanBoardProps) {
    const [showAddForm, setShowAddForm] = useState<TaskStatus | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newStartDate, setNewStartDate] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [newPriority, setNewPriority] = useState('none');
    const [copied, setCopied] = useState(false);

    const handleAdd = async (status: TaskStatus) => {
        if (!newTitle.trim()) return;
        await onAddTask({
            title: newTitle.trim(),
            assigneeName: newAssignee.trim() || undefined,
            startDate: newStartDate || undefined,
            dueDate: newDueDate || undefined,
            priority: newPriority,
        });
        // After adding, immediately move to the right status
        // The task is created as 'todo' by default, so we may need to update
        setNewTitle('');
        setNewAssignee('');
        setNewStartDate('');
        setNewDueDate('');
        setNewPriority('none');
        setShowAddForm(null);
    };

    const handleCopyInvite = async () => {
        if (boardInviteCode) {
            await navigator.clipboard.writeText(boardInviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getStatusTasks = (status: TaskStatus) => tasks.filter(t => t.status === status);

    // Available next statuses for a task
    const getNextStatuses = (current: TaskStatus): TaskStatus[] => {
        switch (current) {
            case 'todo': return ['in_progress'];
            case 'in_progress': return ['done', 'todo'];
            case 'done': return ['todo'];
        }
    };

    return (
        <div className={styles.board}>
            {/* Invite Code Bar */}
            {boardInviteCode && (
                <div className={styles.inviteBar}>
                    <span className={styles.inviteLabel}>Invite Code:</span>
                    <code className={styles.inviteCode}>{boardInviteCode}</code>
                    <button className={styles.inviteCopy} onClick={handleCopyInvite}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className={styles.statsRow}>
                {STATUS_CONFIG.map(s => (
                    <div key={s.key} className={styles.statChip} style={{ borderColor: s.color, color: s.color }}>
                        <span className={styles.statDot} style={{ background: s.color }} />
                        {getStatusTasks(s.key).length} {s.label}
                    </div>
                ))}
            </div>

            {/* Kanban Columns */}
            <div className={styles.columns}>
                {STATUS_CONFIG.map(col => {
                    const columnTasks = getStatusTasks(col.key);
                    return (
                        <div key={col.key} className={styles.column}>
                            <div className={styles.columnHeader}>
                                <div className={styles.columnDot} style={{ background: col.color }} />
                                <h3 className={styles.columnTitle}>{col.label}</h3>
                                <span className={styles.columnCount}>{columnTasks.length}</span>
                                <button
                                    className={styles.columnAdd}
                                    onClick={() => setShowAddForm(showAddForm === col.key ? null : col.key)}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            {/* Add Task Form */}
                            <AnimatePresence>
                                {showAddForm === col.key && (
                                    <motion.div
                                        className={styles.addForm}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <input
                                            className={styles.addInput}
                                            placeholder="Task title..."
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(col.key); }}
                                            autoFocus
                                        />
                                        <div className={styles.addRow}>
                                            <div className={styles.addField}>
                                                <User size={13} />
                                                <input
                                                    className={styles.addSmallInput}
                                                    placeholder="Assign to..."
                                                    value={newAssignee}
                                                    onChange={e => setNewAssignee(e.target.value)}
                                                    list="member-suggestions"
                                                />
                                                <datalist id="member-suggestions">
                                                    {members.map(m => (
                                                        <option key={m.userId} value={m.name} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>
                                        <div className={styles.addRow}>
                                            <div className={styles.addField}>
                                                <Calendar size={13} />
                                                <input type="date" className={styles.addDateInput} value={newStartDate} onChange={e => setNewStartDate(e.target.value)} title="Start date" />
                                            </div>
                                            <span className={styles.addDateSep}>to</span>
                                            <div className={styles.addField}>
                                                <Clock size={13} />
                                                <input type="date" className={styles.addDateInput} value={newDueDate} onChange={e => setNewDueDate(e.target.value)} title="End date" />
                                            </div>
                                        </div>
                                        <div className={styles.addRow}>
                                            <select className={styles.addSelect} value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                                                <option value="none">No priority</option>
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                            <button className={styles.addSubmit} onClick={() => handleAdd(col.key)} disabled={!newTitle.trim()}>
                                                <Plus size={14} /> Add
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Task Cards */}
                            <div className={styles.cardList}>
                                <AnimatePresence mode="popLayout">
                                    {columnTasks.map(task => (
                                        <motion.div
                                            key={task.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className={styles.card}
                                            onClick={() => onTaskClick(task)}
                                        >
                                            {task.priority !== 'none' && (
                                                <div className={styles.cardPriority} style={{ background: PRIORITY_COLORS[task.priority] }} />
                                            )}
                                            <div className={styles.cardTitle}>{task.title}</div>

                                            {(task.startDate || task.dueDate) && (
                                                <div className={styles.cardDates}>
                                                    <Calendar size={12} />
                                                    {task.startDate && <span>{task.startDate}</span>}
                                                    {task.startDate && task.dueDate && <span>-</span>}
                                                    {task.dueDate && <span>{task.dueDate}</span>}
                                                </div>
                                            )}

                                            <div className={styles.cardFooter}>
                                                {task.assignee && (
                                                    <div className={styles.cardAssignee}>
                                                        <div className={styles.cardAvatar}>
                                                            {task.assignee.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span>{task.assignee.name}</span>
                                                    </div>
                                                )}

                                                {task.subtasks && task.subtasks.length > 0 && (
                                                    <div className={styles.cardSubtasks}>
                                                        {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick move buttons */}
                                            <div className={styles.cardMoves}>
                                                {getNextStatuses(task.status).map(nextStatus => {
                                                    const cfg = STATUS_CONFIG.find(s => s.key === nextStatus)!;
                                                    return (
                                                        <button
                                                            key={nextStatus}
                                                            className={styles.moveBtn}
                                                            style={{ color: cfg.color, borderColor: cfg.color }}
                                                            onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, nextStatus); }}
                                                            title={`Move to ${cfg.label}`}
                                                        >
                                                            <ChevronRight size={12} />
                                                            {cfg.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {columnTasks.length === 0 && (
                                    <div className={styles.emptyColumn}>
                                        <p>No tasks yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
