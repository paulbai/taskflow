"use client";

import React, { useState } from 'react';
import clsx from 'clsx';
import { Calendar, Plus } from 'lucide-react';
import type { DbRow, DbSelectOption } from '@/lib/office-types';
import { Avatar, Tag } from './Cells';
import { RowModal } from './RowModal';
import {
    firstColumnOfType,
    formatDate,
    memberName,
    rowTitle,
    type ViewProps,
} from './db-utils';
import styles from './ListView.module.css';

export function ListView({ db, rows, members, onUpdateRow, onCreateRow, onDeleteRow, onUpdateSchema }: ViewProps) {
    const schema = db.schema;
    const [openRowId, setOpenRowId] = useState<string>('');
    const checkboxColumn = firstColumnOfType(schema, 'checkbox');
    const dateColumn = firstColumnOfType(schema, 'date');
    const personColumn = firstColumnOfType(schema, 'person');
    const selectColumns = schema.filter(c => c.type === 'select' || c.type === 'multiSelect');
    const openRow = rows.find(r => r.id === openRowId);

    const rowTags = (row: DbRow): DbSelectOption[] => {
        const tags: DbSelectOption[] = [];
        for (const col of selectColumns) {
            const raw = row.data[col.id];
            const ids = col.type === 'multiSelect'
                ? (Array.isArray(raw) ? raw : [])
                : (typeof raw === 'string' ? [raw] : []);
            for (const id of ids) {
                const opt = col.options?.find(o => o.id === id);
                if (opt) tags.push(opt);
            }
        }
        return tags.slice(0, 3);
    };

    return (
        <>
            <div className={styles.list}>
                {rows.length === 0 && <div className={styles.empty}>No rows yet</div>}
                {rows.map(row => {
                    const done = checkboxColumn ? Boolean(row.data[checkboxColumn.id]) : false;
                    const dateLabel = dateColumn ? formatDate(row.data[dateColumn.id]) : '';
                    const personName = personColumn ? memberName(members, row.data[personColumn.id]) : '';
                    return (
                        <div
                            key={row.id}
                            className={styles.row}
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenRowId(row.id)}
                            onKeyDown={e => { if (e.key === 'Enter') setOpenRowId(row.id); }}
                        >
                            {checkboxColumn && (
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={done}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => onUpdateRow(row.id, { [checkboxColumn.id]: e.target.checked })}
                                />
                            )}
                            <span className={clsx(styles.title, done && styles.titleDone)}>
                                {rowTitle(row, schema)}
                            </span>
                            <span className={styles.props}>
                                {rowTags(row).map(t => <Tag key={t.id} option={t} />)}
                                {personName && <Avatar name={personName} size={20} />}
                                {dateLabel && (
                                    <span className={styles.date}>
                                        <Calendar size={11} />
                                        {dateLabel}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <button className={styles.newRow} onClick={() => onCreateRow({})}>
                    <Plus size={14} />
                    New row
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
        </>
    );
}
