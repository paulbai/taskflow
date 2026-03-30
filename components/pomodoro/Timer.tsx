"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './Timer.module.css';
import { Timer as TimerIcon, Play, Pause, RotateCw, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;
const CIRCLE_RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export function Timer() {
    const [isOpen, setIsOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
    const [isActive, setIsActive] = useState(false);
    const [phase, setPhase] = useState<'Focus' | 'Break'>('Focus');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const totalTime = phase === 'Focus' ? FOCUS_TIME : BREAK_TIME;
    const progress = useMemo(() => 1 - timeLeft / totalTime, [timeLeft, totalTime]);
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            if (phase === 'Focus') {
                setPhase('Break');
                setTimeLeft(BREAK_TIME);
            } else {
                setPhase('Focus');
                setTimeLeft(FOCUS_TIME);
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, timeLeft, phase]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(phase === 'Focus' ? FOCUS_TIME : BREAK_TIME);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.container}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={styles.panel}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className={styles.panelHeader}>
                            <span className={styles.panelTitle}>Pomodoro</span>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setIsOpen(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className={styles.timerCircle}>
                            <svg className={styles.progressRing} viewBox="0 0 180 180">
                                <circle
                                    className={styles.ringBg}
                                    cx="90"
                                    cy="90"
                                    r={CIRCLE_RADIUS}
                                    fill="none"
                                    strokeWidth="4"
                                />
                                <circle
                                    className={clsx(
                                        styles.ringProgress,
                                        phase === 'Focus' ? styles.ringFocus : styles.ringBreak
                                    )}
                                    cx="90"
                                    cy="90"
                                    r={CIRCLE_RADIUS}
                                    fill="none"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={CIRCUMFERENCE}
                                    strokeDashoffset={strokeDashoffset}
                                    transform="rotate(-90 90 90)"
                                />
                            </svg>
                            <div className={styles.timerContent}>
                                <span className={styles.phaseLabel}>{phase}</span>
                                <span className={styles.timerDisplay}>{formatTime(timeLeft)}</span>
                            </div>
                        </div>

                        <div className={styles.controls}>
                            <Button
                                variant={isActive ? 'ghost' : 'primary'}
                                style={{ flex: 1 }}
                                onClick={toggleTimer}
                            >
                                {isActive ? <Pause size={16} /> : <Play size={16} />}
                                {isActive ? 'Pause' : 'Start'}
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={resetTimer}
                                title="Reset"
                            >
                                <RotateCw size={16} />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                className={clsx(styles.fab, isActive && styles.fabActive)}
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
            >
                {isActive ? (
                    <span className={styles.fabTime}>{formatTime(timeLeft)}</span>
                ) : (
                    <TimerIcon size={22} />
                )}
            </motion.button>
        </div>
    );
}
