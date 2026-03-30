"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TaskList } from '@/components/tasks/TaskList';
import { CalendarView } from '@/components/calendar/CalendarView';
import { Loader2, Timer as TimerIcon, Play, Pause, RotateCw, UserPlus, X } from 'lucide-react';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/components/providers/AppContext';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function Home() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const { activeListId, activeList, activeTab, setActiveListId, refreshLists } = useAppContext();
    const { data: session } = useSession();

    // Join task modal state
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinResult, setJoinResult] = useState<{ success: boolean; message: string } | null>(null);

    // Pomodoro state
    const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
    const [timerActive, setTimerActive] = useState(false);
    const [phase, setPhase] = useState<'Focus' | 'Break'>('Focus');

    const totalTime = phase === 'Focus' ? FOCUS_TIME : BREAK_TIME;

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
            if (phase === 'Focus') { setPhase('Break'); setTimeLeft(BREAK_TIME); }
            else { setPhase('Focus'); setTimeLeft(FOCUS_TIME); }
        }
        return () => { if (interval) clearInterval(interval); };
    }, [timerActive, timeLeft, phase]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const fetchTasks = useCallback(async () => {
        if (!activeListId) return;
        try {
            const res = await fetch(`/api/lists/${activeListId}/tasks`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } finally {
            setLoading(false);
        }
    }, [activeListId]);

    useEffect(() => {
        setLoading(true);
        fetchTasks();
    }, [fetchTasks]);

    const addTask = async (title: string) => {
        const res = await fetch(`/api/lists/${activeListId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (res.ok) {
            const task = await res.json();
            setTasks(prev => [task, ...prev]);
        }
    };

    const updateTask = async (updatedTask: Task) => {
        const res = await fetch(`/api/tasks/${updatedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTask),
        });
        if (res.ok) {
            const task = await res.json();
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        }
    };

    const toggleTask = async (id: string) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCompleted: !task.isCompleted }),
        });
        if (res.ok) {
            const updated = await res.json();
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
        }
    };

    const deleteTask = async (id: string) => {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setTasks(prev => prev.filter(t => t.id !== id));
        }
    };

    const handleJoinTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        setJoinLoading(true);
        setJoinResult(null);
        try {
            const res = await fetch('/api/join-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: joinCode.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setJoinResult({ success: true, message: data.message });
                setJoinCode('');
                await refreshLists();
                if (data.listId) setActiveListId(data.listId);
                // Refresh tasks to show the new one
                setTimeout(() => {
                    fetchTasks();
                    setShowJoinModal(false);
                    setJoinResult(null);
                }, 2000);
            } else {
                setJoinResult({ success: false, message: data.error || 'Failed to join task' });
            }
        } catch {
            setJoinResult({ success: false, message: 'Something went wrong. Please try again.' });
        }
        setJoinLoading(false);
    };

    const activeTasks = tasks.filter(t => !t.isCompleted);
    const completedTasks = tasks.filter(t => t.isCompleted);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const firstName = session?.user?.name?.split(' ')[0] || 'there';

    if (loading) {
        return (
            <div className={styles.loadingWrap}>
                <div className={styles.spinner}>
                    <Loader2 size={28} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Greeting Header - always visible */}
            <header className={styles.greeting}>
                <div>
                    <p className={styles.greetingText}>{getGreeting()}, {firstName}!</p>
                    <h1 className={styles.taskSummary}>
                        You have <span className={styles.highlight}>{activeTasks.length} tasks</span> today
                    </h1>
                </div>
                <div className={styles.avatarCircle}>
                    {firstName.charAt(0).toUpperCase()}
                </div>
            </header>

            {/* Join Task Button */}
            <button className={styles.joinTaskBtn} onClick={() => { setShowJoinModal(true); setJoinResult(null); setJoinCode(''); }}>
                <UserPlus size={18} />
                <span>Join a Task</span>
            </button>

            {/* Join Task Modal */}
            <AnimatePresence>
                {showJoinModal && (
                    <motion.div
                        className={styles.joinOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowJoinModal(false)}
                    >
                        <motion.div
                            className={styles.joinModal}
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.joinHeader}>
                                <h3 className={styles.joinTitle}>Join a Task</h3>
                                <button className={styles.joinClose} onClick={() => setShowJoinModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <p className={styles.joinDesc}>
                                Enter the invite code shared with you to join and collaborate on a task.
                            </p>
                            <form onSubmit={handleJoinTask} className={styles.joinForm}>
                                <input
                                    className={styles.joinInput}
                                    value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. A1B2C3D4"
                                    maxLength={12}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className={styles.joinSubmit}
                                    disabled={joinLoading || !joinCode.trim()}
                                >
                                    <UserPlus size={18} />
                                    {joinLoading ? 'Joining...' : 'Join Task'}
                                </button>
                            </form>
                            {joinResult && (
                                <div className={joinResult.success ? styles.joinSuccess : styles.joinError}>
                                    {joinResult.message}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Cards */}
            <div className={styles.statsRow}>
                <div className={`${styles.statCard} ${styles.statTodo}`}>
                    <div className={styles.statNumber}>{activeTasks.length}</div>
                    <div className={styles.statLabel}>To-Do</div>
                </div>
                <div className={`${styles.statCard} ${styles.statDone}`}>
                    <div className={styles.statNumber}>{completedTasks.length}</div>
                    <div className={styles.statLabel}>Done</div>
                </div>
                <div className={`${styles.statCard} ${styles.statTotal}`}>
                    <div className={styles.statNumber}>{tasks.length}</div>
                    <div className={styles.statLabel}>Total</div>
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                    {activeTab === 'home' && (
                        <TaskList
                            tasks={tasks}
                            onAddTask={addTask}
                            onToggleTask={toggleTask}
                            onUpdateTask={updateTask}
                            onDeleteTask={deleteTask}
                        />
                    )}

                    {activeTab === 'calendar' && (
                        <CalendarView tasks={tasks} />
                    )}

                    {activeTab === 'timer' && (
                        <div className={styles.timerView}>
                            <div className={styles.timerCircle}>
                                <svg className={styles.timerRing} viewBox="0 0 200 200">
                                    <circle cx="100" cy="100" r="88" fill="none" strokeWidth="6" stroke="var(--border-subtle)" />
                                    <circle
                                        cx="100" cy="100" r="88" fill="none" strokeWidth="6"
                                        stroke={phase === 'Focus' ? 'var(--accent)' : 'var(--color-success)'}
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 88}
                                        strokeDashoffset={2 * Math.PI * 88 * (timeLeft / totalTime)}
                                        transform="rotate(-90 100 100)"
                                        style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 8px ${phase === 'Focus' ? 'var(--accent-glow)' : 'rgba(76, 175, 80, 0.3)'})` }}
                                    />
                                </svg>
                                <div className={styles.timerInner}>
                                    <span className={styles.phaseLabel}>{phase}</span>
                                    <span className={styles.timerDisplay}>{formatTime(timeLeft)}</span>
                                </div>
                            </div>
                            <div className={styles.timerControls}>
                                <button
                                    className={`${styles.timerBtn} ${timerActive ? styles.timerBtnPause : styles.timerBtnPlay}`}
                                    onClick={() => setTimerActive(!timerActive)}
                                >
                                    {timerActive ? <Pause size={22} /> : <Play size={22} />}
                                    {timerActive ? 'Pause' : 'Start'}
                                </button>
                                <button
                                    className={styles.timerBtnReset}
                                    onClick={() => { setTimerActive(false); setTimeLeft(phase === 'Focus' ? FOCUS_TIME : BREAK_TIME); }}
                                >
                                    <RotateCw size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
