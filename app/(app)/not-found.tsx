import Link from 'next/link';

export default function NotFound() {
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
            <div style={{ fontSize: '48px' }}>🔍</div>
            <h2
                style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                }}
            >
                Page not found
            </h2>
            <p
                style={{
                    fontSize: '14px',
                    color: 'var(--text-tertiary)',
                    maxWidth: '360px',
                    lineHeight: 1.5,
                }}
            >
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/"
                style={{
                    padding: '12px 28px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    background: 'var(--accent-gradient)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px var(--accent-glow)',
                }}
            >
                Go home
            </Link>
        </div>
    );
}
