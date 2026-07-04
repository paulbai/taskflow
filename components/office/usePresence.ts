"use client";

import { useEffect } from 'react';
import { useTopbar } from './TopbarState';

/**
 * Track presence on a page: heartbeat every 10 seconds while the tab is
 * visible, and surface other viewers' avatars in the topbar.
 */
export function usePresence(pageId: string | null) {
    const { setPresence } = useTopbar();

    useEffect(() => {
        if (!pageId) {
            setPresence([]);
            return;
        }

        let cancelled = false;

        const beat = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const res = await fetch('/api/presence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pageId }),
                });
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setPresence(
                        (data.presence || []).map((p: { userId: string; name: string }) => ({
                            userId: p.userId,
                            name: p.name,
                        }))
                    );
                }
            } catch {
                // network hiccup — keep last known presence
            }
        };

        beat();
        const interval = setInterval(beat, 10_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
            setPresence([]);
        };
    }, [pageId, setPresence]);
}
