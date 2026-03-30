"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckSquare, LogIn, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function SignInPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError('Invalid email or password');
        } else {
            router.push('/');
            router.refresh();
        }
    };

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
                        <CheckSquare size={28} />
                    </div>
                    <h1 className={styles.title}>Welcome back!</h1>
                    <p className={styles.subtitle}>Sign in to your TaskFlow account</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.field}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="your@email.com"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="Enter your password"
                        />
                    </div>

                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                        <LogIn size={18} />
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className={styles.footerText}>
                    Don&apos;t have an account?{' '}
                    <a href="/signup" className={styles.link}>
                        Sign up <ArrowRight size={14} />
                    </a>
                </p>
            </motion.div>
        </div>
    );
}
