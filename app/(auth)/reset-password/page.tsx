"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LockKeyhole, Check, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/signin'), 2500);
            } else {
                setError(data.error || 'Something went wrong. Please try again.');
            }
        } catch {
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <>
                <div className={styles.error}>
                    This reset link is missing its token. Please use the link from your email,
                    or request a new one.
                </div>
                <p className={styles.footerText}>
                    <Link href="/forgot-password" className={styles.link}>
                        Request a new link
                    </Link>
                </p>
            </>
        );
    }

    if (success) {
        return (
            <div className={styles.success}>
                Password updated! Taking you to sign in…
            </div>
        );
    }

    return (
        <>
            <form onSubmit={handleSubmit} className={styles.form}>
                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.field}>
                    <label className={styles.label}>New password</label>
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        minLength={8}
                        required
                        autoFocus
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Confirm password</label>
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="Same password again"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        minLength={8}
                        required
                    />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading || !password || !confirm}>
                    <Check size={18} />
                    {loading ? 'Updating…' : 'Update password'}
                </button>
            </form>

            <p className={styles.footerText}>
                <Link href="/signin" className={styles.link}>
                    <ArrowLeft size={14} />
                    Back to sign in
                </Link>
            </p>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className={styles.page}>
            <div className={styles.decoration} />
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className={styles.logoWrap}>
                    <div className={styles.logoCircle}>
                        <LockKeyhole size={28} />
                    </div>
                    <h1 className={styles.title}>Set a new password</h1>
                    <p className={styles.subtitle}>Choose a strong password for your account</p>
                </div>

                <Suspense fallback={null}>
                    <ResetPasswordForm />
                </Suspense>
            </motion.div>
        </div>
    );
}
