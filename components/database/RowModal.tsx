"use client";

import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { DbColumn, DbRow, OfficeMember } from '@/lib/office-types';
import { CellEditor } from './Cells';
import { ColumnTypeIcon } from './column-icons';
import { rowTitle } from './db-utils';
import styles from './RowModal.module.css';

interface RowModalProps {
    schema: DbColumn[];
    row: DbRow;
    members: OfficeMember[];
    onUpdateRow: (rowId: string, data: Record<string, unknown>) => void;
    onDeleteRow: (rowId: string) => void;
    onUpdateSchema: (schema: DbColumn[]) => void;
    onClose: () => void;
}

export function RowModal({ schema, row, members, onUpdateRow, onDeleteRow, onUpdateSchema, onClose }: RowModalProps) {
    return (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal} role="dialog" aria-modal="true">
                <div className={styles.header}>
                    <div className={styles.title}>{rowTitle(row, schema)}</div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className={styles.body}>
                    {schema.map(col => (
                        <div className={styles.field} key={col.id}>
                            <span className={styles.fieldLabel}>
                                <ColumnTypeIcon type={col.type} size={13} />
                                {col.name}
                            </span>
                            <div className={styles.fieldEditor}>
                                <CellEditor
                                    column={col}
                                    value={row.data[col.id]}
                                    rowData={row.data}
                                    schema={schema}
                                    members={members}
                                    onChange={value => onUpdateRow(row.id, { [col.id]: value })}
                                    onChangeSchema={onUpdateSchema}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className={styles.footer}>
                    <button
                        className={styles.deleteBtn}
                        onClick={() => {
                            onDeleteRow(row.id);
                            onClose();
                        }}
                    >
                        <Trash2 size={14} />
                        Delete row
                    </button>
                </div>
            </div>
        </div>
    );
}
