'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('App error:', error);
    }, [error]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh',
                gap: '16px',
                padding: '24px',
                textAlign: 'center',
            }}
        >
            <div style={{ fontSize: '48px' }}>😵</div>
            <h2
                style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                }}
            >
                Something went wrong
            </h2>
            <p
                style={{
                    fontSize: '14px',
                    color: 'var(--text-tertiary)',
                    maxWidth: '360px',
                    lineHeight: 1.5,
                }}
            >
                An unexpected error occurred. Please try again.
            </p>
            <button
                onClick={reset}
                style={{
                    padding: '12px 28px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    background: 'var(--accent-gradient)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--accent-glow)',
                }}
            >
                Try again
            </button>
        </div>
    );
}
