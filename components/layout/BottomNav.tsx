"use client";

import React from 'react';
import styles from './BottomNav.module.css';
import { Home, Calendar, Timer, FolderOpen, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppContext } from '../providers/AppContext';

interface BottomNavProps {
    onListsOpen: () => void;
}

export function BottomNav({ onListsOpen }: BottomNavProps) {
    const { activeTab, setActiveTab } = useAppContext();

    const tabs = [
        { id: 'home' as const, icon: Home, label: 'Home' },
        { id: 'boards' as const, icon: LayoutGrid, label: 'Boards' },
        { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
        { id: 'timer' as const, icon: Timer, label: 'Focus' },
    ];

    return (
        <nav className={styles.nav}>
            <div className={styles.inner}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={clsx(styles.tab, activeTab === tab.id && styles.active)}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className={styles.iconWrap}>
                            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        </span>
                        <span className={styles.label}>{tab.label}</span>
                    </button>
                ))}
                <button
                    className={styles.tab}
                    onClick={onListsOpen}
                >
                    <span className={styles.iconWrap}>
                        <FolderOpen size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.label}>Lists</span>
                </button>
            </div>
        </nav>
    );
}
