"use client";

import React, { useState, useEffect, useCallback } from 'react';
import styles from './AppLayout.module.css';
import { BottomNav } from './BottomNav';
import { ListDrawer } from './ListDrawer';
import { Sun, Moon } from 'lucide-react';
import { Timer } from '../pomodoro/Timer';
import { AppContextProvider } from '../providers/AppContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<'dark' | 'light'>('light');
    const [showListDrawer, setShowListDrawer] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('taskflow-theme') as 'dark' | 'light' | null;
        if (stored) {
            setTheme(stored);
            document.documentElement.setAttribute('data-theme', stored);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('taskflow-theme', next);
    }, [theme]);

    return (
        <AppContextProvider>
            <div className={styles.container}>
                <main className={styles.main}>
                    {children}
                </main>

                <button
                    className={styles.themeToggle}
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <BottomNav onListsOpen={() => setShowListDrawer(true)} />

                <ListDrawer
                    isOpen={showListDrawer}
                    onClose={() => setShowListDrawer(false)}
                />

                <Timer />
            </div>
        </AppContextProvider>
    );
}
