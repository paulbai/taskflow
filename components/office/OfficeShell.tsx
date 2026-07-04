"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './OfficeShell.module.css';
import { OfficeProvider, useOffice } from './OfficeContext';
import { TopbarStateProvider } from './TopbarState';
import { OfficeSidebar } from './OfficeSidebar';
import { Topbar } from './Topbar';
import { SearchModal } from './SearchModal';
import { AiPanel } from '@/components/ai/AiPanel';

function ShellInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { workspace, workspaces, loading } = useOffice();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Apply persisted theme on mount
    useEffect(() => {
        const stored = localStorage.getItem('taskflow-theme');
        if (stored) document.documentElement.setAttribute('data-theme', stored);
    }, []);

    // Global keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(o => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const openSearch = useCallback(() => {
        setSearchOpen(true);
        setMobileOpen(false);
    }, []);

    if (loading) {
        return (
            <div className={styles.loadingWrap}>
                <div className={styles.spinner} />
                Loading workspace…
            </div>
        );
    }

    if (!workspace) {
        // Slug didn't match any workspace the user belongs to
        if (workspaces.length > 0) {
            router.replace(`/w/${workspaces[0].slug}`);
            return (
                <div className={styles.loadingWrap}>
                    <div className={styles.spinner} />
                </div>
            );
        }
        return (
            <div className={styles.loadingWrap}>
                <span>No workspace found.</span>
                <button
                    onClick={() => router.push('/')}
                    style={{
                        padding: '10px 24px', borderRadius: 12, border: 'none',
                        background: 'var(--accent-gradient)', color: 'white',
                        fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)',
                    }}
                >
                    Create one in TaskFlow
                </button>
            </div>
        );
    }

    return (
        <div className={styles.shell}>
            <OfficeSidebar
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
                onOpenSearch={openSearch}
            />
            <div className={styles.content}>
                <Topbar onMobileMenuOpen={() => setMobileOpen(true)} />
                <main className={styles.main}>{children}</main>
            </div>
            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            <AiPanel />
        </div>
    );
}

export default function OfficeShell({ children }: { children: React.ReactNode }) {
    return (
        <OfficeProvider>
            <TopbarStateProvider>
                <ShellInner>{children}</ShellInner>
            </TopbarStateProvider>
        </OfficeProvider>
    );
}
