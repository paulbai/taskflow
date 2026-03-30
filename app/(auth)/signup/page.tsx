"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckSquare, UserPlus, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function SignUpPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            setError(data.error || 'Something went wrong');
            setLoading(false);
            return;
        }

        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError('Account created but sign-in failed. Please sign in manually.');
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
                    <h1 className={styles.title}>Create your account</h1>
                    <p className={styles.subtitle}>Get started with TaskFlow</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.field}>
                        <label className={styles.label}>Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="Your name"
                        />
                    </div>

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
                            minLength={8}
                            className={styles.input}
                            placeholder="At least 8 characters"
                        />
                    </div>

                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                        <UserPlus size={18} />
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className={styles.footerText}>
                    Already have an account?{' '}
                    <a href="/signin" className={styles.link}>
                        Sign in <ArrowRight size={14} />
                    </a>
                </p>
            </motion.div>
        </div>
    );
}
