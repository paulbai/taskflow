"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, MessageSquare, Sun, Moon, LogOut, Home } from 'lucide-react';
import styles from './Topbar.module.css';
import { useOffice } from './OfficeContext';
import { useTopbar } from './TopbarState';
import { NotificationsBell } from '@/components/office/NotificationsBell';

export function Topbar({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) {
    const router = useRouter();
    const { data: session } = useSession();
    const { workspace } = useOffice();
    const { crumbs, saveStatus, commentCount, commentsOpen, setCommentsOpen, presence } = useTopbar();

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const stored = localStorage.getItem('taskflow-theme') as 'light' | 'dark' | null;
        if (stored) setTheme(stored);
    }, []);

    useEffect(() => {
        if (!userMenuOpen) return;
        const close = () => setUserMenuOpen(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [userMenuOpen]);

    const toggleTheme = useCallback(() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('taskflow-theme', next);
    }, [theme]);

    const userName = session?.user?.name || 'You';
    const userEmail = session?.user?.email || '';
    const initial = userName.charAt(0).toUpperCase();

    const members = workspace?.members || [];
    const shownMembers = members.slice(0, 4);
    const extraCount = members.length - shownMembers.length;

    return (
        <header className={styles.topbar}>
            <button className={styles.menuBtn} onClick={onMobileMenuOpen} aria-label="Open menu">
                <Menu size={18} />
            </button>

            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                {workspace && (
                    <button className={styles.crumb} onClick={() => router.push(`/w/${workspace.slug}`)}>
                        {workspace.iconEmoji} {workspace.name}
                    </button>
                )}
                {crumbs.map((crumb, i) => (
                    <React.Fragment key={i}>
                        <span className={styles.crumbSep}>/</span>
                        {crumb.href ? (
                            <button className={styles.crumb} onClick={() => router.push(crumb.href!)}>
                                {crumb.emoji ? `${crumb.emoji} ` : ''}{crumb.label}
                            </button>
                        ) : (
                            <span className={`${styles.crumb} ${styles.crumbCurrent}`}>
                                {crumb.emoji ? `${crumb.emoji} ` : ''}{crumb.label}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </nav>

            <div className={styles.right}>
                {saveStatus && (
                    <span className={styles.saveStatus}>
                        {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
                    </span>
                )}

                {presence.length > 0 && (
                    <div className={styles.avatarStack} title={presence.map(p => p.name).join(', ')}>
                        {presence.slice(0, 3).map(p => (
                            <span key={p.userId} className={styles.avatar}>{p.name.charAt(0).toUpperCase()}</span>
                        ))}
                    </div>
                )}

                {members.length > 0 && presence.length === 0 && (
                    <div className={styles.avatarStack} title={members.map(m => m.name).join(', ')}>
                        {shownMembers.map(m => (
                            <span key={m.userId} className={styles.avatar}>{m.name.charAt(0).toUpperCase()}</span>
                        ))}
                        {extraCount > 0 && (
                            <span className={`${styles.avatar} ${styles.avatarMore}`}>+{extraCount}</span>
                        )}
                    </div>
                )}

                <button
                    className={styles.iconBtn}
                    onClick={() => setCommentsOpen(!commentsOpen)}
                    aria-label="Comments"
                >
                    <MessageSquare size={17} />
                    {commentCount > 0 && <span className={styles.badge}>{commentCount > 99 ? '99+' : commentCount}</span>}
                </button>

                <NotificationsBell />

                <div className={styles.userMenuWrap}>
                    <button
                        className={styles.avatar}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={e => { e.stopPropagation(); setUserMenuOpen(o => !o); }}
                        aria-label="User menu"
                    >
                        {initial}
                    </button>
                    {userMenuOpen && (
                        <div className={styles.userMenu} onClick={e => e.stopPropagation()}>
                            <div className={styles.userMenuHeader}>
                                <div className={styles.userMenuName}>{userName}</div>
                                <div className={styles.userMenuEmail}>{userEmail}</div>
                            </div>
                            <button className={styles.userMenuItem} onClick={toggleTheme}>
                                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                            </button>
                            <button className={styles.userMenuItem} onClick={() => router.push('/')}>
                                <Home size={14} />
                                TaskFlow classic
                            </button>
                            <button className={styles.userMenuItem} onClick={() => signOut({ callbackUrl: '/signin' })}>
                                <LogOut size={14} />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
