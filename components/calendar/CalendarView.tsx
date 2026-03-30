"use client";

import React, { useState } from 'react';
import styles from './CalendarView.module.css';
import { Task } from '../../types';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'framer-motion';

interface CalendarViewProps {
    tasks: Task[];
}

export function CalendarView({ tasks }: CalendarViewProps) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getTasksForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return tasks.filter(t => t.dueDate === dateStr);
    };

    const goToPrev = () => {
        if (month === 0) { setMonth(11); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };

    const goToNext = () => {
        if (month === 11) { setMonth(0); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    const goToToday = () => {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
    };

    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.monthTitle}>
                    {monthName} <span className={styles.yearLabel}>{year}</span>
                </h2>
                <div className={styles.navGroup}>
                    <Button size="small" variant="ghost" onClick={goToPrev}><ChevronLeft size={16} /></Button>
                    <Button size="small" variant="ghost" onClick={goToToday}>Today</Button>
                    <Button size="small" variant="ghost" onClick={goToNext}><ChevronRight size={16} /></Button>
                </div>
            </div>

            <motion.div
                key={`${year}-${month}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <div className={styles.grid}>
                    {weekDays.map(d => (
                        <div key={d} className={styles.dayHeader}>{d}</div>
                    ))}

                    {days.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className={clsx(styles.dayCell, styles.empty)} />;

                        const dayTasks = getTasksForDay(day);

                        return (
                            <div key={day} className={clsx(styles.dayCell, isToday(day) && styles.currentDay)}>
                                <div className={clsx(styles.dateNumber, isToday(day) && styles.todayBadge)}>
                                    {day}
                                </div>
                                {dayTasks.map(task => (
                                    <div key={task.id} className={clsx(styles.taskDot, styles[`priority-${task.priority}`])}>
                                        {task.title}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}
