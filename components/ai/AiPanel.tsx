"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Send, FileText } from 'lucide-react';
import styles from './AiPanel.module.css';
import { blocksToPlainText } from '@/lib/blocks';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export function AiPanel() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [notConfigured, setNotConfigured] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);

    // Extract current page id from the URL (if on a page route)
    const pageIdMatch = pathname?.match(/\/page\/([a-z0-9]+)/i);
    const currentPageId = pageIdMatch?.[1] || null;

    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const getPageContext = useCallback(async (): Promise<string> => {
        if (!currentPageId) return '';
        try {
            const res = await fetch(`/api/pages/${currentPageId}`);
            if (!res.ok) return '';
            const page = await res.json();
            return `Title: ${page.title}\n\n${blocksToPlainText(page.content)}`;
        } catch {
            return '';
        }
    }, [currentPageId]);

    const handleError = useCallback(async (res: Response) => {
        if (res.status === 503) {
            setNotConfigured(true);
            return 'AI is not set up yet — see the note above.';
        }
        try {
            const data = await res.json();
            return data.error || 'Something went wrong. Please try again.';
        } catch {
            return 'Something went wrong. Please try again.';
        }
    }, []);

    const summarize = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        setMessages(prev => [...prev, { role: 'user', content: 'Summarize this page' }]);
        try {
            const context = await getPageContext();
            if (!context) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Open a page first, then I can summarize it for you.' }]);
                return;
            }
            const res = await fetch('/api/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: context }),
            });
            if (!res.ok) {
                const errMsg = await handleError(res);
                setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
                return;
            }
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.summary }]);
        } finally {
            setBusy(false);
        }
    }, [busy, getPageContext, handleError]);

    const send = useCallback(async () => {
        const question = input.trim();
        if (!question || busy) return;
        setInput('');
        setBusy(true);

        const history: ChatMessage[] = [...messages, { role: 'user', content: question }];
        setMessages(history);

        try {
            const pageContext = await getPageContext();
            const res = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: history.slice(-20),
                    pageContext: pageContext || undefined,
                }),
            });

            if (!res.ok || !res.body) {
                const errMsg = await handleError(res);
                setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
                return;
            }

            // Stream the response into the last assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let acc = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                acc += decoder.decode(value, { stream: true });
                const current = acc;
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { role: 'assistant', content: current };
                    return next;
                });
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Connection lost. Please try again.' }]);
        } finally {
            setBusy(false);
        }
    }, [input, busy, messages, getPageContext, handleError]);

    if (!open) {
        return (
            <button className={styles.fab} onClick={() => setOpen(true)} aria-label="AI assistant">
                <Sparkles size={22} />
            </button>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.headerIcon}><Sparkles size={16} /></span>
                <span className={styles.headerTitle}>AI Assistant</span>
                <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {notConfigured && (
                <div className={styles.notice}>
                    <strong>AI isn&apos;t set up yet.</strong> Add an <code>ANTHROPIC_API_KEY</code> environment
                    variable to enable summaries, writing help, and chat. Get a key at{' '}
                    <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>.
                </div>
            )}

            <div className={styles.quickActions}>
                <button className={styles.quickBtn} onClick={summarize} disabled={busy || !currentPageId}>
                    <FileText size={14} />
                    Summarize page
                </button>
            </div>

            <div className={styles.chat} ref={chatRef}>
                {messages.length === 0 && (
                    <div className={styles.emptyChat}>
                        <span className={styles.emptyChatIcon}>✨</span>
                        <span>
                            Ask me anything about your workspace.<br />
                            {currentPageId ? 'I can see the page you have open.' : 'Open a page to give me context.'}
                        </span>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`${styles.msg} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
                    >
                        {msg.content || '…'}
                    </div>
                ))}
                {busy && messages[messages.length - 1]?.role === 'user' && (
                    <div className={styles.thinking}>
                        <span className={styles.thinkingDot} />
                        <span className={styles.thinkingDot} />
                        <span className={styles.thinkingDot} />
                    </div>
                )}
            </div>

            <div className={styles.inputRow}>
                <textarea
                    className={styles.input}
                    rows={1}
                    placeholder="Ask anything…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                />
                <button className={styles.sendBtn} onClick={send} disabled={busy || !input.trim()} aria-label="Send">
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
