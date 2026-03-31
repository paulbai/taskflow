"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './WorkspaceView.module.css';
import { KanbanBoard } from '../board/KanbanBoard';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { Workspace, Board, Task, TaskStatus, WorkspaceMember } from '@/types';
import { Plus, Building2, Users, ArrowLeft, UserPlus, X, Briefcase, Home as HomeIcon, UsersRound, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WORKSPACE_TYPES = [
    { value: 'company', label: 'Company', icon: Building2 },
    { value: 'family', label: 'Family', icon: HomeIcon },
    { value: 'team', label: 'Team', icon: UsersRound },
    { value: 'other', label: 'Other', icon: Layers },
];

export function WorkspaceView() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
    const [activeBoard, setActiveBoard] = useState<Board | null>(null);
    const [boardTasks, setBoardTasks] = useState<Task[]>([]);
    const [boardMembers, setBoardMembers] = useState<WorkspaceMember[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Create modals
    const [showCreateWS, setShowCreateWS] = useState(false);
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [wsName, setWsName] = useState('');
    const [wsType, setWsType] = useState('team');
    const [boardName, setBoardName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [joinResult, setJoinResult] = useState<{ success: boolean; message: string } | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const fetchWorkspaces = useCallback(async () => {
        try {
            const res = await fetch('/api/workspaces');
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const fetchBoardTasks = useCallback(async (boardId: string) => {
        const res = await fetch(`/api/boards/${boardId}/tasks`);
        if (res.ok) {
            const data = await res.json();
            setBoardTasks(data);
        }
    }, []);

    const fetchBoardDetails = useCallback(async (boardId: string) => {
        const res = await fetch(`/api/boards/${boardId}`);
        if (res.ok) {
            const data = await res.json();
            setBoardMembers(data.members || []);
        }
    }, []);

    const openBoard = (ws: Workspace, board: Board) => {
        setActiveWorkspace(ws);
        setActiveBoard(board);
        fetchBoardTasks(board.id);
        fetchBoardDetails(board.id);
    };

    const handleCreateWorkspace = async () => {
        if (!wsName.trim() || formLoading) return;
        setFormLoading(true);
        const res = await fetch('/api/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: wsName.trim(), type: wsType }),
        });
        if (res.ok) {
            const ws = await res.json();
            setWorkspaces(prev => [ws, ...prev]);
            setShowCreateWS(false);
            setWsName('');
            setWsType('team');
        }
        setFormLoading(false);
    };

    const handleCreateBoard = async () => {
        if (!boardName.trim() || !activeWorkspace || formLoading) return;
        setFormLoading(true);
        const res = await fetch(`/api/workspaces/${activeWorkspace.id}/boards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: boardName.trim() }),
        });
        if (res.ok) {
            const board = await res.json();
            setWorkspaces(prev => prev.map(w =>
                w.id === activeWorkspace.id ? { ...w, boards: [...w.boards, board] } : w
            ));
            setActiveWorkspace(prev => prev ? { ...prev, boards: [...prev.boards, board] } : null);
            setShowCreateBoard(false);
            setBoardName('');
            // Immediately open the new board
            openBoard({ ...activeWorkspace, boards: [...activeWorkspace.boards, board] }, board);
        }
        setFormLoading(false);
    };

    const handleJoin = async () => {
        if (!joinCode.trim() || formLoading) return;
        setFormLoading(true);
        setJoinResult(null);
        const res = await fetch('/api/workspaces/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: joinCode.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
            setJoinResult({ success: true, message: data.message });
            setJoinCode('');
            await fetchWorkspaces();
            setTimeout(() => { setShowJoin(false); setJoinResult(null); }, 2000);
        } else {
            setJoinResult({ success: false, message: data.error || 'Failed to join' });
        }
        setFormLoading(false);
    };

    const handleAddTask = async (data: { title: string; description?: string; priority?: string; startDate?: string; dueDate?: string; assigneeName?: string }) => {
        if (!activeBoard) return;
        const res = await fetch(`/api/boards/${activeBoard.id}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const task = await res.json();
            setBoardTasks(prev => [task, ...prev]);
        }
    };

    const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
        const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            const updated = await res.json();
            setBoardTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        }
    };

    const handleUpdateTask = async (task: Task) => {
        const res = await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
        });
        if (res.ok) {
            const updated = await res.json();
            setBoardTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
    };

    const handleDeleteTask = async (id: string) => {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setBoardTasks(prev => prev.filter(t => t.id !== id));
        }
    };

    // ── Board View ──
    if (activeBoard && activeWorkspace) {
        return (
            <div className={styles.boardView}>
                <div className={styles.boardHeader}>
                    <button className={styles.backBtn} onClick={() => { setActiveBoard(null); setActiveWorkspace(null); }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p className={styles.breadcrumb}>{activeWorkspace.name}</p>
                        <h2 className={styles.boardTitle}>{activeBoard.name}</h2>
                    </div>
                    <div className={styles.memberAvatars}>
                        {boardMembers.slice(0, 4).map(m => (
                            <div key={m.userId} className={styles.miniAvatar} title={m.name}>
                                {m.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        {boardMembers.length > 4 && (
                            <div className={styles.miniAvatar}>+{boardMembers.length - 4}</div>
                        )}
                    </div>
                </div>

                <KanbanBoard
                    tasks={boardTasks}
                    members={boardMembers}
                    boardInviteCode={activeBoard.inviteCode}
                    onAddTask={handleAddTask}
                    onUpdateTaskStatus={handleUpdateTaskStatus}
                    onTaskClick={(task) => { setSelectedTask(task); setIsModalOpen(true); }}
                />

                <TaskDetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    task={selectedTask}
                    onSave={handleUpdateTask}
                    onDelete={handleDeleteTask}
                />
            </div>
        );
    }

    // ── Workspace List View ──
    if (loading) {
        return <div className={styles.loading}>Loading workspaces...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Workspaces</h2>
                <div className={styles.headerActions}>
                    <button className={styles.joinBtn} onClick={() => { setShowJoin(true); setJoinResult(null); setJoinCode(''); }}>
                        <UserPlus size={16} /> Join
                    </button>
                    <button className={styles.createBtn} onClick={() => setShowCreateWS(true)}>
                        <Plus size={16} /> New
                    </button>
                </div>
            </div>

            {workspaces.length === 0 ? (
                <div className={styles.empty}>
                    <Building2 size={48} className={styles.emptyIcon} />
                    <h3>No workspaces yet</h3>
                    <p>Create a workspace for your company, family, or team to start collaborating.</p>
                    <button className={styles.emptyBtn} onClick={() => setShowCreateWS(true)}>
                        <Plus size={16} /> Create Workspace
                    </button>
                </div>
            ) : (
                <div className={styles.workspaceList}>
                    {workspaces.map(ws => (
                        <div key={ws.id} className={styles.wsCard}>
                            <div className={styles.wsCardHeader}>
                                <div className={styles.wsIcon}>
                                    {ws.type === 'company' ? <Building2 size={20} /> :
                                     ws.type === 'family' ? <HomeIcon size={20} /> :
                                     <UsersRound size={20} />}
                                </div>
                                <div className={styles.wsInfo}>
                                    <h3 className={styles.wsName}>{ws.name}</h3>
                                    <div className={styles.wsMeta}>
                                        <Users size={13} /> {ws.members.length} {ws.members.length === 1 ? 'member' : 'members'}
                                        <span className={styles.wsType}>{ws.type}</span>
                                    </div>
                                </div>
                            </div>

                            {ws.boards.length > 0 ? (
                                <div className={styles.boardList}>
                                    {ws.boards.map(board => (
                                        <button
                                            key={board.id}
                                            className={styles.boardCard}
                                            onClick={() => openBoard(ws, board)}
                                        >
                                            <Briefcase size={16} />
                                            <div className={styles.boardInfo}>
                                                <span className={styles.boardName}>{board.name}</span>
                                                <span className={styles.boardMeta}>{board.taskCount || 0} tasks</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noBoardsText}>No boards yet</p>
                            )}

                            <button
                                className={styles.addBoardBtn}
                                onClick={() => { setActiveWorkspace(ws); setShowCreateBoard(true); }}
                            >
                                <Plus size={14} /> Add Board
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create Workspace Modal ── */}
            <AnimatePresence>
                {showCreateWS && (
                    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateWS(false)}>
                        <motion.div className={styles.modal} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Create Workspace</h3>
                                <button className={styles.closeBtn} onClick={() => setShowCreateWS(false)}><X size={18} /></button>
                            </div>
                            <p className={styles.modalDesc}>Create a workspace for your company, family, or team.</p>

                            <input className={styles.modalInput} placeholder="Workspace name (e.g. Acme Corp)" value={wsName} onChange={e => setWsName(e.target.value)} autoFocus maxLength={100} />

                            <div className={styles.typeGrid}>
                                {WORKSPACE_TYPES.map(t => (
                                    <button key={t.value} className={`${styles.typeBtn} ${wsType === t.value ? styles.typeBtnActive : ''}`} onClick={() => setWsType(t.value)}>
                                        <t.icon size={20} />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button className={styles.submitBtn} onClick={handleCreateWorkspace} disabled={!wsName.trim() || formLoading}>
                                {formLoading ? 'Creating...' : 'Create Workspace'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Create Board Modal ── */}
            <AnimatePresence>
                {showCreateBoard && (
                    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateBoard(false)}>
                        <motion.div className={styles.modal} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Create Board</h3>
                                <button className={styles.closeBtn} onClick={() => setShowCreateBoard(false)}><X size={18} /></button>
                            </div>
                            <p className={styles.modalDesc}>Add a task board to <strong>{activeWorkspace?.name}</strong></p>

                            <input className={styles.modalInput} placeholder="Board name (e.g. Q2 Sprint)" value={boardName} onChange={e => setBoardName(e.target.value)} autoFocus maxLength={100} />

                            <button className={styles.submitBtn} onClick={handleCreateBoard} disabled={!boardName.trim() || formLoading}>
                                {formLoading ? 'Creating...' : 'Create Board'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Join Modal ── */}
            <AnimatePresence>
                {showJoin && (
                    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoin(false)}>
                        <motion.div className={styles.modal} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Join Workspace</h3>
                                <button className={styles.closeBtn} onClick={() => setShowJoin(false)}><X size={18} /></button>
                            </div>
                            <p className={styles.modalDesc}>Enter the invite code to join a workspace or board.</p>

                            <input
                                className={styles.codeInput}
                                placeholder="e.g. A1B2C3D4E5F6"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={20}
                                autoFocus
                            />

                            <button className={styles.submitBtn} onClick={handleJoin} disabled={!joinCode.trim() || formLoading}>
                                <UserPlus size={16} />
                                {formLoading ? 'Joining...' : 'Join'}
                            </button>

                            {joinResult && (
                                <div className={joinResult.success ? styles.successMsg : styles.errorMsg}>
                                    {joinResult.message}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
