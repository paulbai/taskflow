export default function OfflinePage() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: '16px',
                padding: '24px',
                textAlign: 'center',
            }}
        >
            <div style={{ fontSize: '48px' }}>📡</div>
            <h1
                style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                }}
            >
                You&apos;re offline
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: 360, lineHeight: 1.5 }}>
                Check your connection — your changes will sync when you reconnect.
            </p>
        </div>
    );
}
