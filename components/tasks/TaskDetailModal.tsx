import React, { useState, useEffect } from 'react';
import styles from './TaskDetailModal.module.css';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Task, Priority, TaskStatus, Subtask } from '../../types';
import { Trash2, Copy, Check, Users, Plus, X, CheckCircle2, Circle, Calendar, Clock, Link2, ExternalLink, User } from 'lucide-react';
import { clsx } from 'clsx';

interface TaskDetailModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const priorityColors: Record<Priority, string> = {
    none: 'var(--text-tertiary)',
    low: 'var(--color-low)',
    medium: 'var(--color-medium)',
    high: 'var(--color-high)',
};

const STATUS_OPTIONS: { key: TaskStatus; label: string; color: string }[] = [
    { key: 'todo', label: 'To Do', color: '#f5a623' },
    { key: 'in_progress', label: 'In Progress', color: '#5b8def' },
    { key: 'done', label: 'Done', color: '#4c8c4a' },
];

export function TaskDetailModal({ task, isOpen, onClose, onSave, onDelete }: TaskDetailModalProps) {
    const [editedTask, setEditedTask] = useState<Task | null>(task);
    const [copied, setCopied] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [subtaskLoading, setSubtaskLoading] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkTitle, setNewLinkTitle] = useState('');

    useEffect(() => {
        setEditedTask(task);
        setCopied(false);
        setNewSubtaskTitle('');
        setNewLinkUrl('');
        setNewLinkTitle('');
    }, [task]);

    if (!editedTask) return null;

    const handleSave = async () => {
        await onSave(editedTask);
        onClose();
    };

    const setPriority = (p: Priority) => {
        setEditedTask({ ...editedTask, priority: p });
    };

    const setStatus = (s: TaskStatus) => {
        setEditedTask({ ...editedTask, status: s });
    };

    const handleCopyCode = async () => {
        if (editedTask.inviteCode) {
            await navigator.clipboard.writeText(editedTask.inviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // ── Links handlers ──
    const links: { title?: string; url: string }[] = (() => {
        if (Array.isArray(editedTask.links)) return editedTask.links as unknown as { title?: string; url: string }[];
        if (typeof editedTask.links === 'string') {
            try { return JSON.parse(editedTask.links); } catch { return []; }
        }
        return [];
    })();

    const handleAddLink = () => {
        if (!newLinkUrl.trim()) return;
        let url = newLinkUrl.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        const newLink = { title: newLinkTitle.trim() || undefined, url };
        const updatedLinks = [...links, newLink];
        setEditedTask({ ...editedTask, links: updatedLinks as unknown as string });
        setNewLinkUrl('');
        setNewLinkTitle('');
    };

    const handleRemoveLink = (index: number) => {
        const updatedLinks = links.filter((_, i) => i !== index);
        setEditedTask({ ...editedTask, links: updatedLinks as unknown as string });
    };

    // ── Subtask handlers ──
    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim() || subtaskLoading) return;
        setSubtaskLoading(true);
        try {
            const res = await fetch(`/api/tasks/${editedTask.id}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newSubtaskTitle.trim() }),
            });
            if (res.ok) {
                const subtask = await res.json();
                setEditedTask({
                    ...editedTask,
                    subtasks: [...editedTask.subtasks, subtask],
                });
                setNewSubtaskTitle('');
            }
        } finally {
            setSubtaskLoading(false);
        }
    };

    const handleToggleSubtask = async (subtask: Subtask) => {
        const res = await fetch(`/api/subtasks/${subtask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCompleted: !subtask.isCompleted }),
        });
        if (res.ok) {
            const updated = await res.json();
            setEditedTask({
                ...editedTask,
                subtasks: editedTask.subtasks.map(s => s.id === updated.id ? updated : s),
            });
        }
    };

    const handleDeleteSubtask = async (subtaskId: string) => {
        const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
        if (res.ok) {
            setEditedTask({
                ...editedTask,
                subtasks: editedTask.subtasks.filter(s => s.id !== subtaskId),
            });
        }
    };

    const completedCount = editedTask.subtasks.filter(s => s.isCompleted).length;
    const totalSubtasks = editedTask.subtasks.length;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className={styles.form}>
                <input
                    className={styles.titleInput}
                    value={editedTask.title}
                    onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                    placeholder="Task Title"
                />

                {/* Status Section */}
                <div className={styles.section}>
                    <div className={styles.label}>Status</div>
                    <div className={styles.statusGroup}>
                        {STATUS_OPTIONS.map(s => (
                            <button
                                key={s.key}
                                className={clsx(styles.statusBtn, editedTask.status === s.key && styles.statusActive)}
                                style={{
                                    borderColor: editedTask.status === s.key ? s.color : undefined,
                                    color: editedTask.status === s.key ? s.color : undefined,
                                    background: editedTask.status === s.key ? `${s.color}12` : undefined,
                                }}
                                onClick={() => setStatus(s.key)}
                            >
                                <span className={styles.statusDot} style={{ background: s.color }} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dates Section */}
                <div className={styles.section}>
                    <div className={styles.label}><Calendar size={14} /> Dates</div>
                    <div className={styles.dateRow}>
                        <div className={styles.dateField}>
                            <span className={styles.dateLabel}>Start</span>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={editedTask.startDate || ''}
                                onChange={e => setEditedTask({ ...editedTask, startDate: e.target.value || undefined })}
                            />
                        </div>
                        <div className={styles.dateSep}>&rarr;</div>
                        <div className={styles.dateField}>
                            <span className={styles.dateLabel}>Due</span>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={editedTask.dueDate || ''}
                                onChange={e => setEditedTask({ ...editedTask, dueDate: e.target.value || undefined })}
                            />
                        </div>
                    </div>
                </div>

                {/* Assignee display */}
                {editedTask.assignee && (
                    <div className={styles.section}>
                        <div className={styles.label}><User size={14} /> Assigned To</div>
                        <div className={styles.assigneeDisplay}>
                            <div className={styles.assigneeAvatar}>
                                {editedTask.assignee.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{editedTask.assignee.name}</span>
                        </div>
                    </div>
                )}

                {/* Invite Code Section */}
                {editedTask.inviteCode && (
                    <div className={styles.inviteSection}>
                        <div className={styles.inviteHeader}>
                            <Users size={16} />
                            <span>Invite to collaborate</span>
                        </div>
                        <div className={styles.inviteRow}>
                            <code className={styles.inviteCode}>{editedTask.inviteCode}</code>
                            <button className={styles.copyButton} onClick={handleCopyCode}>
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <p className={styles.inviteHint}>
                            Share this code with others so they can join and collaborate on this task.
                        </p>
                    </div>
                )}

                {/* Subtasks Section */}
                <div className={styles.section}>
                    <div className={styles.subtaskHeader}>
                        <div className={styles.label}>
                            Subtasks {totalSubtasks > 0 && <span className={styles.subtaskCount}>{completedCount}/{totalSubtasks}</span>}
                        </div>
                    </div>

                    {totalSubtasks > 0 && (
                        <div className={styles.subtaskProgress}>
                            <div
                                className={styles.subtaskProgressBar}
                                style={{ width: `${totalSubtasks > 0 ? (completedCount / totalSubtasks) * 100 : 0}%` }}
                            />
                        </div>
                    )}

                    <div className={styles.subtaskList}>
                        {editedTask.subtasks.map(subtask => (
                            <div key={subtask.id} className={clsx(styles.subtaskItem, subtask.isCompleted && styles.subtaskDone)}>
                                <button
                                    className={styles.subtaskCheck}
                                    onClick={() => handleToggleSubtask(subtask)}
                                >
                                    {subtask.isCompleted ? (
                                        <CheckCircle2 size={18} />
                                    ) : (
                                        <Circle size={18} />
                                    )}
                                </button>
                                <span className={styles.subtaskTitle}>{subtask.title}</span>
                                <button
                                    className={styles.subtaskDelete}
                                    onClick={() => handleDeleteSubtask(subtask.id)}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className={styles.subtaskAdd}>
                        <input
                            className={styles.subtaskInput}
                            value={newSubtaskTitle}
                            onChange={e => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add a subtask..."
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                            maxLength={500}
                        />
                        <button
                            className={styles.subtaskAddBtn}
                            onClick={handleAddSubtask}
                            disabled={!newSubtaskTitle.trim() || subtaskLoading}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                {/* Document Links Section */}
                <div className={styles.section}>
                    <div className={styles.label}><Link2 size={14} /> Document Links</div>
                    <p className={styles.linkHint}>Attach links to documents, files, or evidence of completed tasks.</p>

                    {links.length > 0 && (
                        <div className={styles.linkList}>
                            {links.map((link, i) => (
                                <div key={i} className={styles.linkItem}>
                                    <ExternalLink size={14} className={styles.linkIcon} />
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.linkUrl}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {link.title || link.url}
                                    </a>
                                    <button className={styles.linkRemove} onClick={() => handleRemoveLink(i)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.linkAdd}>
                        <input
                            className={styles.linkInput}
                            value={newLinkTitle}
                            onChange={e => setNewLinkTitle(e.target.value)}
                            placeholder="Link title (optional)"
                            maxLength={200}
                        />
                        <div className={styles.linkUrlRow}>
                            <input
                                className={styles.linkInput}
                                value={newLinkUrl}
                                onChange={e => setNewLinkUrl(e.target.value)}
                                placeholder="https://..."
                                maxLength={2000}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                            />
                            <button
                                className={styles.subtaskAddBtn}
                                onClick={handleAddLink}
                                disabled={!newLinkUrl.trim()}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.label}>Notes</div>
                    <Input
                        value={editedTask.description || ''}
                        onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                        placeholder="Add details..."
                    />
                </div>

                <div className={styles.section}>
                    <div className={styles.label}>Priority</div>
                    <div className={styles.priorityGroup}>
                        {(['none', 'low', 'medium', 'high'] as Priority[]).map(p => (
                            <button
                                key={p}
                                className={clsx(
                                    styles.priorityBtn,
                                    editedTask.priority === p && styles.priorityActive
                                )}
                                onClick={() => setPriority(p)}
                                style={{
                                    borderColor: editedTask.priority === p ? priorityColors[p] : undefined,
                                    color: editedTask.priority === p ? priorityColors[p] : undefined,
                                }}
                            >
                                {p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.actions}>
                    <Button
                        variant="danger"
                        size="small"
                        className={styles.deleteButton}
                        onClick={async () => { await onDelete(editedTask.id); onClose(); }}
                    >
                        <Trash2 size={14} /> Delete
                    </Button>

                    <Button size="small" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button size="small" variant="primary" onClick={handleSave}>Save</Button>
                </div>
            </div>
        </Modal>
    );
}
