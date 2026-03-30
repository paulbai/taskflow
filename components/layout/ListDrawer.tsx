"use client";

import React, { useState } from 'react';
import styles from './ListDrawer.module.css';
import { clsx } from 'clsx';
import { Plus, Users, LogOut, Link2, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../providers/AppContext';
import { signOut, useSession } from 'next-auth/react';

interface ListDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ListDrawer({ isOpen, onClose }: ListDrawerProps) {
    const { lists, activeListId, setActiveListId, refreshLists } = useAppContext();
    const { data: session } = useSession();
    const [showNewList, setShowNewList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const [copiedId, setCopiedId] = useState('');

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
        onClose();
    };

    const handleCopyInvite = async (code: string, listId: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedId(listId);
        setTimeout(() => setCopiedId(''), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className={styles.overlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className={styles.drawer}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className={styles.handle} />

                        <div className={styles.header}>
                            <h2 className={styles.title}>My Lists</h2>
                            <button className={styles.closeBtn} onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.content}>
                            {personalLists.length > 0 && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>Personal</div>
                                    {personalLists.map(list => (
                                        <button
                                            key={list.id}
                                            className={clsx(styles.listItem, activeListId === list.id && styles.active)}
                                            onClick={() => selectList(list.id)}
                                        >
                                            <span className={styles.listIcon}>{list.icon}</span>
                                            <span className={styles.listName}>{list.name}</span>
                                            <span className={styles.badge}>{list.taskCount}</span>
                                            {list.inviteCode && (
                                                <button
                                                    className={styles.copyBtn}
                                                    onClick={(e) => { e.stopPropagation(); handleCopyInvite(list.inviteCode!, list.id); }}
                                                    title="Copy invite code"
                                                >
                                                    {copiedId === list.id ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {sharedLists.length > 0 && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>Shared</div>
                                    {sharedLists.map(list => (
                                        <button
                                            key={list.id}
                                            className={clsx(styles.listItem, activeListId === list.id && styles.active)}
                                            onClick={() => selectList(list.id)}
                                        >
                                            <Users size={16} className={styles.listIconSvg} />
                                            <span className={styles.listName}>{list.name}</span>
                                            <span className={styles.badge}>{list.memberCount} members</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {showNewList && (
                                <form onSubmit={handleCreateList} className={styles.inlineForm}>
                                    <input
                                        autoFocus
                                        value={newListName}
                                        onChange={e => setNewListName(e.target.value)}
                                        placeholder="List name..."
                                        onBlur={() => { if (!newListName.trim()) setShowNewList(false); }}
                                        className={styles.inlineInput}
                                    />
                                </form>
                            )}

                            {showJoin && (
                                <form onSubmit={handleJoin} className={styles.inlineForm}>
                                    <input
                                        autoFocus
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value)}
                                        placeholder="Paste invite code..."
                                        className={styles.inlineInput}
                                    />
                                    {joinError && <p className={styles.error}>{joinError}</p>}
                                </form>
                            )}

                            <div className={styles.actions}>
                                <button className={styles.actionBtn} onClick={() => { setShowNewList(true); setShowJoin(false); }}>
                                    <Plus size={18} />
                                    <span>New List</span>
                                </button>
                                <button className={styles.actionBtn} onClick={() => { setShowJoin(true); setShowNewList(false); }}>
                                    <Link2 size={18} />
                                    <span>Join List</span>
                                </button>
                            </div>
                        </div>

                        {session?.user && (
                            <div className={styles.footer}>
                                <div className={styles.userInfo}>
                                    <div className={styles.avatar}>
                                        {session.user.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <span className={styles.userName}>{session.user.name}</span>
                                </div>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/signin' })}
                                    className={styles.logoutBtn}
                                    title="Sign out"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
