"use client";

import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { clsx } from 'clsx';
import { CheckSquare, Plus, Users, Sun, Moon, LogOut, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../providers/AppContext';
import { signOut, useSession } from 'next-auth/react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
}

export function Sidebar({ isOpen, onClose, theme, onToggleTheme }: SidebarProps) {
    const { lists, activeListId, setActiveListId, refreshLists } = useAppContext();
    const { data: session } = useSession();
    const [showNewList, setShowNewList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');

    const personalLists = lists.filter(l => !l.isShared);
    const sharedLists = lists.filter(l => l.isShared);

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) return;
        const res = await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newListName.trim() }),
        });
        if (res.ok) {
            setNewListName('');
            setShowNewList(false);
            await refreshLists();
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinError('');
        const res = await fetch('/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: joinCode.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
            setJoinCode('');
            setShowJoin(false);
            await refreshLists();
            if (data.listId) setActiveListId(data.listId);
        } else {
            setJoinError(data.error || 'Failed to join');
        }
    };

    const selectList = (id: string) => {
        setActiveListId(id);
        if (window.innerWidth < 768) onClose();
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={styles.mobileOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            <aside className={clsx(styles.sidebar, isOpen && styles.open)}>
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>
                            <CheckSquare size={20} />
                        </div>
                        <span className={styles.logoText}>TaskFlow</span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    {personalLists.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>Personal</div>
                            <ul className={styles.navList}>
                                {personalLists.map(list => (
                                    <li
                                        key={list.id}
                                        className={clsx(styles.navItem, activeListId === list.id && styles.active)}
                                        onClick={() => selectList(list.id)}
                                    >
                                        {activeListId === list.id && <span className={styles.activeIndicator} />}
                                        <span className={styles.navIcon}>{list.icon}</span>
                                        <span className={styles.navLabel}>{list.name}</span>
                                        <span className={styles.badge}>{list.taskCount}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {sharedLists.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>Shared</div>
                            <ul className={styles.navList}>
                                {sharedLists.map(list => (
                                    <li
                                        key={list.id}
                                        className={clsx(styles.navItem, activeListId === list.id && styles.active)}
                                        onClick={() => selectList(list.id)}
                                    >
                                        {activeListId === list.id && <span className={styles.activeIndicator} />}
                                        <Users size={14} className={styles.navIconSvg} />
                                        <span className={styles.navLabel}>{list.name}</span>
                                        <span className={styles.badge}>{list.memberCount}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </nav>

                {showNewList && (
                    <form onSubmit={handleCreateList} style={{ padding: '0 8px', marginBottom: 8 }}>
                        <input
                            autoFocus
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            placeholder="List name..."
                            onBlur={() => { if (!newListName.trim()) setShowNewList(false); }}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-focus)', background: 'var(--bg-surface)',
                                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                            }}
                        />
                    </form>
                )}

                {showJoin && (
                    <form onSubmit={handleJoin} style={{ padding: '0 8px', marginBottom: 8 }}>
                        <input
                            autoFocus
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            placeholder="Paste invite code..."
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-focus)', background: 'var(--bg-surface)',
                                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                            }}
                        />
                        {joinError && <p style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>{joinError}</p>}
                    </form>
                )}

                <div className={styles.footer}>
                    <button className={styles.newListBtn} onClick={() => { setShowNewList(true); setShowJoin(false); }}>
                        <Plus size={16} />
                        <span>New List</span>
                    </button>

                    <button className={styles.themeBtn} onClick={() => { setShowJoin(true); setShowNewList(false); }} title="Join shared list">
                        <Link2 size={16} />
                    </button>

                    <button className={styles.themeBtn} onClick={onToggleTheme} aria-label="Toggle theme">
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>

                {session?.user && (
                    <div style={{
                        padding: '12px 8px 0', borderTop: '1px solid var(--border-subtle)',
                        marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.user.name}
                        </span>
                        <button
                            onClick={() => signOut({ callbackUrl: '/signin' })}
                            className={styles.themeBtn}
                            title="Sign out"
                            style={{ width: 32, height: 32 }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
