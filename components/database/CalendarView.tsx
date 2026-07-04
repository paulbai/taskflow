"use client";

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DbRow } from '@/lib/office-types';
import { RowModal } from './RowModal';
import {
    colorVar,
    firstColumnOfType,
    optionForValue,
    rowTitle,
    type ViewProps,
} from './db-utils';
import styles from './CalendarView.module.css';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_PILLS = 3;

function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function CalendarView({ db, rows, members, onUpdateRow, onCreateRow, onDeleteRow, onUpdateSchema }: ViewProps) {
    const schema = db.schema;
    const dateColumn = firstColumnOfType(schema, 'date');
    const selectColumn = firstColumnOfType(schema, 'select');
    const titleCol = schema.find(c => c.type === 'text');
    const [cursor, setCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [openRowId, setOpenRowId] = useState<string>('');
    const openRow = rows.find(r => r.id === openRowId);

    const rowsByDate = useMemo(() => {
        const map = new Map<string, DbRow[]>();
        if (!dateColumn) return map;
        for (const row of rows) {
            const raw = row.data[dateColumn.id];
            if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw)) continue;
            const key = raw.slice(0, 10);
            const list = map.get(key) || [];
            list.push(row);
            map.set(key, list);
        }
        return map;
    }, [rows, dateColumn]);

    const days = useMemo(() => {
        const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        // Monday-first offset
        const offset = (firstOfMonth.getDay() + 6) % 7;
        const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset);
        const result: Date[] = [];
        for (let i = 0; i < 42; i++) {
            result.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        }
        return result;
    }, [cursor]);

    if (!dateColumn) {
        return (
            <div className={styles.empty}>
                Add a date column to this database to use the calendar view.
            </div>
        );
    }

    const todayKey = toDateKey(new Date());
    const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const createOnDay = (key: string) => {
        const data: Record<string, unknown> = { [dateColumn.id]: key };
        if (titleCol) data[titleCol.id] = '';
        onCreateRow(data);
    };

    const pillColor = (row: DbRow): string => {
        const opt = selectColumn ? optionForValue(selectColumn, row.data[selectColumn.id]) : undefined;
        const base = opt ? colorVar(opt.color) : 'var(--accent)';
        return `color-mix(in srgb, ${base} 22%, transparent)`;
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.header}>
                <span className={styles.monthTitle}>{monthLabel}</span>
                <button
                    className={styles.navBtn}
                    aria-label="Previous month"
                    onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                >
                    <ChevronLeft size={15} />
                </button>
                <button
                    className={styles.navBtn}
                    aria-label="Next month"
                    onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                >
                    <ChevronRight size={15} />
                </button>
                <button
                    className={styles.todayBtn}
                    onClick={() => {
                        const now = new Date();
                        setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                    }}
                >
                    Today
                </button>
                <span className={styles.hint}>Click a day to add a row</span>
            </div>
            <div className={styles.grid}>
                {DAY_NAMES.map(name => (
                    <div key={name} className={styles.dayName}>{name}</div>
                ))}
                {days.map(day => {
                    const key = toDateKey(day);
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const dayRows = rowsByDate.get(key) || [];
                    return (
                        <div
                            key={key}
                            className={clsx(styles.day, !inMonth && styles.dayOutside)}
                            onClick={() => createOnDay(key)}
                        >
                            <span className={clsx(styles.dayNum, key === todayKey && styles.dayNumToday)}>
                                {day.getDate()}
                            </span>
                            {dayRows.slice(0, MAX_PILLS).map(row => (
                                <button
                                    key={row.id}
                                    className={styles.pill}
                                    style={{ background: pillColor(row) }}
                                    onClick={e => { e.stopPropagation(); setOpenRowId(row.id); }}
                                >
                                    {rowTitle(row, schema)}
                                </button>
                            ))}
                            {dayRows.length > MAX_PILLS && (
                                <span className={styles.more}>+{dayRows.length - MAX_PILLS} more</span>
                            )}
                        </div>
                    );
                })}
            </div>
            {openRow && (
                <RowModal
                    schema={schema}
                    row={openRow}
                    members={members}
                    onUpdateRow={onUpdateRow}
                    onDeleteRow={onDeleteRow}
                    onUpdateSchema={onUpdateSchema}
                    onClose={() => setOpenRowId('')}
                />
            )}
        </div>
    );
}
