"use client";

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, Plus } from 'lucide-react';
import { Avatar } from './Cells';
import { RowModal } from './RowModal';
import {
    colorVar,
    firstColumnOfType,
    formatDate,
    memberName,
    nextTagColor,
    rowTitle,
    uid,
    type ViewProps,
} from './db-utils';
import styles from './BoardView.module.css';

const NO_STATUS = '__none__';

export function BoardView({ db, rows, members, onUpdateRow, onCreateRow, onDeleteRow, onUpdateSchema }: ViewProps) {
    const schema = db.schema;
    const selectColumns = schema.filter(c => c.type === 'select');
    const [groupColumnId, setGroupColumnId] = useState<string>('');
    const [dragRowId, setDragRowId] = useState<string>('');
    const [overColumn, setOverColumn] = useState<string>('');
    const [openRowId, setOpenRowId] = useState<string>('');

    const groupColumn = selectColumns.find(c => c.id === groupColumnId) || selectColumns[0];
    const dateColumn = firstColumnOfType(schema, 'date');
    const personColumn = firstColumnOfType(schema, 'person');
    const titleCol = schema.find(c => c.type === 'text');

    const columns = useMemo(() => {
        if (!groupColumn) return [];
        const options = groupColumn.options || [];
        const groups = options.map(opt => ({
            key: opt.id,
            label: opt.label,
            color: colorVar(opt.color),
            rows: rows.filter(r => r.data[groupColumn.id] === opt.id),
        }));
        groups.push({
            key: NO_STATUS,
            label: 'No status',
            color: 'var(--text-disabled)',
            rows: rows.filter(r => !options.some(o => o.id === r.data[groupColumn.id])),
        });
        return groups;
    }, [groupColumn, rows]);

    const openRow = rows.find(r => r.id === openRowId);

    if (!groupColumn) {
        return (
            <div className={styles.empty}>
                Add a select column to this database to use the board view.
            </div>
        );
    }

    const handleDrop = (columnKey: string) => {
        setOverColumn('');
        if (!dragRowId) return;
        const row = rows.find(r => r.id === dragRowId);
        setDragRowId('');
        if (!row) return;
        const nextValue = columnKey === NO_STATUS ? null : columnKey;
        if (row.data[groupColumn.id] !== nextValue) {
            onUpdateRow(row.id, { [groupColumn.id]: nextValue });
        }
    };

    const addCard = (columnKey: string) => {
        const data: Record<string, unknown> = {};
        if (columnKey !== NO_STATUS) data[groupColumn.id] = columnKey;
        if (titleCol) data[titleCol.id] = '';
        onCreateRow(data);
    };

    const addBoardColumn = () => {
        const label = window.prompt('New column name');
        if (!label?.trim()) return;
        const options = groupColumn.options || [];
        onUpdateSchema(schema.map(c => c.id === groupColumn.id
            ? { ...c, options: [...options, { id: uid(), label: label.trim(), color: nextTagColor(options) }] }
            : c));
    };

    return (
        <div className={styles.wrap}>
            {selectColumns.length > 1 && (
                <div className={styles.toolbar}>
                    <span className={styles.toolbarLabel}>Group by</span>
                    <select
                        className={styles.groupSelect}
                        value={groupColumn.id}
                        onChange={e => setGroupColumnId(e.target.value)}
                    >
                        {selectColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}
            <div className={styles.board}>
                {columns.map(col => (
                    <div
                        key={col.key}
                        className={clsx(styles.column, overColumn === col.key && styles.columnOver)}
                        onDragOver={e => { e.preventDefault(); setOverColumn(col.key); }}
                        onDragLeave={e => {
                            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                                setOverColumn(prev => prev === col.key ? '' : prev);
                            }
                        }}
                        onDrop={e => { e.preventDefault(); handleDrop(col.key); }}
                    >
                        <div className={styles.columnHeader}>
                            <span className={styles.columnDot} style={{ background: col.color }} />
                            <span className={styles.columnTitle}>{col.label}</span>
                            <span className={styles.columnCount}>{col.rows.length}</span>
                        </div>
                        {col.rows.map(row => {
                            const assigneeName = personColumn ? memberName(members, row.data[personColumn.id]) : '';
                            const dateLabel = dateColumn ? formatDate(row.data[dateColumn.id]) : '';
                            return (
                                <div
                                    key={row.id}
                                    className={clsx(styles.card, dragRowId === row.id && styles.cardDragging)}
                                    draggable
                                    onDragStart={e => {
                                        setDragRowId(row.id);
                                        e.dataTransfer.setData('text/plain', row.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragEnd={() => { setDragRowId(''); setOverColumn(''); }}
                                    onClick={() => setOpenRowId(row.id)}
                                >
                                    <span className={styles.cardTitle}>{rowTitle(row, schema)}</span>
                                    {(assigneeName || dateLabel) && (
                                        <div className={styles.cardMeta}>
                                            {assigneeName && <Avatar name={assigneeName} size={20} />}
                                            {dateLabel && (
                                                <span className={styles.cardDate}>
                                                    <Calendar size={11} />
                                                    {dateLabel}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <button className={styles.addCardBtn} onClick={() => addCard(col.key)}>
                            <Plus size={13} />
                            Add card
                        </button>
                    </div>
                ))}
                <button className={styles.addColumnBtn} onClick={addBoardColumn}>
                    <Plus size={14} />
                    Add column
                </button>
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
