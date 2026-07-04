export default function WorkspaceLoading() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {[220, 320, 180, 280, 240].map((width, i) => (
                <div
                    key={i}
                    style={{
                        height: i === 0 ? 32 : 18,
                        width,
                        maxWidth: '80%',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        animation: 'skeletonPulse 1.4s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`,
                    }}
                />
            ))}
            <style>{`
                @keyframes skeletonPulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
