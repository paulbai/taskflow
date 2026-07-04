"use client";

import React from 'react';
import { X } from 'lucide-react';

const SHORTCUTS: { keys: string; action: string }[] = [
    { keys: '⌘ K', action: 'Search everything' },
    { keys: '⌘ /', action: 'Toggle sidebar' },
    { keys: '/', action: 'Open block menu (in editor)' },
    { keys: 'Enter', action: 'New block below' },
    { keys: 'Tab / ⇧Tab', action: 'Indent / unindent block' },
    { keys: '⌘ B / I / U', action: 'Bold / italic / underline selection' },
    { keys: '?', action: 'Show this help' },
    { keys: 'Esc', action: 'Close menus and dialogs' },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: 420, background: 'var(--bg-raised)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)', padding: '20px 24px',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>
                        Keyboard shortcuts
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            width: 30, height: 30, borderRadius: 8, border: 'none',
                            background: 'transparent', color: 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {SHORTCUTS.map(shortcut => (
                        <div key={shortcut.keys} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <kbd
                                style={{
                                    minWidth: 90, textAlign: 'center', padding: '4px 8px',
                                    borderRadius: 6, border: '1px solid var(--border-default)',
                                    background: 'var(--bg-surface)', fontSize: 12, fontWeight: 700,
                                    color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                                }}
                            >
                                {shortcut.keys}
                            </kbd>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{shortcut.action}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
