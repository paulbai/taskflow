"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import styles from './NotificationsBell.module.css';
import type { OfficeNotification } from '@/lib/office-types';

const TYPE_ICONS: Record<string, string> = {
    mention: '💬',
    comment: '💬',
    assigned: '✅',
    invited: '👋',
};

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function NotificationsBell() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<OfficeNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {
            // ignore network errors during polling
        }
    }, []);

    useEffect(() => {
        load();
        intervalRef.current = setInterval(load, 60_000);

        const onVisible = () => {
            if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [open]);

    const markAllRead = useCallback(async () => {
        await fetch('/api/notifications/read', { method: 'PATCH' });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }, []);

    const onItemClick = useCallback((notification: OfficeNotification) => {
        setOpen(false);
        if (notification.linkUrl) router.push(notification.linkUrl);
    }, [router]);

    return (
        <div className={styles.wrap}>
            <button
                className={styles.iconBtn}
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
                <Bell size={17} />
                {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            {open && (
                <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
                    <div className={styles.header}>
                        <span className={styles.title}>Notifications</span>
                        {unreadCount > 0 && (
                            <button className={styles.markRead} onClick={markAllRead}>
                                Mark all as read
                            </button>
                        )}
                    </div>
                    <div className={styles.list}>
                        {notifications.length === 0 && (
                            <div className={styles.empty}>No notifications yet 🎉</div>
                        )}
                        {notifications.map(n => (
                            <button
                                key={n.id}
                                className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
                                onClick={() => onItemClick(n)}
                            >
                                <span className={styles.itemIcon}>{TYPE_ICONS[n.type] || '🔔'}</span>
                                <span className={styles.itemBody}>
                                    <span className={styles.itemMessage}>{n.message}</span>
                                    <span className={styles.itemTime}>{timeAgo(n.createdAt)}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
