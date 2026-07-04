"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { DbRow, DbSelectOption } from '@/lib/office-types';
import { Avatar, Tag } from './Cells';
import { RowModal } from './RowModal';
import {
    colorVar,
    firstColumnOfType,
    initial,
    looksLikeImage,
    memberName,
    rowTitle,
    type ViewProps,
} from './db-utils';
import styles from './GalleryView.module.css';

export function GalleryView({ db, rows, members, onUpdateRow, onCreateRow, onDeleteRow, onUpdateSchema }: ViewProps) {
    const schema = db.schema;
    const [openRowId, setOpenRowId] = useState<string>('');
    const urlColumn = firstColumnOfType(schema, 'url');
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
        return tags.slice(0, 4);
    };

    const placeholderColor = (row: DbRow): string => {
        const tags = rowTags(row);
        return tags.length > 0 ? colorVar(tags[0].color) : 'var(--accent)';
    };

    return (
        <>
            <div className={styles.grid}>
                {rows.map(row => {
                    const title = rowTitle(row, schema);
                    const coverUrl = urlColumn ? row.data[urlColumn.id] : undefined;
                    const tags = rowTags(row);
                    const personName = personColumn ? memberName(members, row.data[personColumn.id]) : '';
                    return (
                        <button key={row.id} className={styles.card} onClick={() => setOpenRowId(row.id)}>
                            {looksLikeImage(coverUrl) ? (
                                <div className={styles.cover} style={{ backgroundImage: `url(${JSON.stringify(String(coverUrl))})` }} />
                            ) : (
                                <div
                                    className={styles.coverPlaceholder}
                                    style={{ background: `linear-gradient(135deg, ${placeholderColor(row)}, color-mix(in srgb, ${placeholderColor(row)} 60%, #ffffff))` }}
                                >
                                    {initial(title)}
                                </div>
                            )}
                            <div className={styles.body}>
                                <span className={styles.title}>{title}</span>
                                {tags.length > 0 && (
                                    <span className={styles.tagRow}>
                                        {tags.map(t => <Tag key={t.id} option={t} />)}
                                    </span>
                                )}
                                {personName && (
                                    <span className={styles.metaRow}>
                                        <Avatar name={personName} size={20} />
                                        <span className={styles.personName}>{personName}</span>
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
                <button className={styles.newCard} onClick={() => onCreateRow({})}>
                    <Plus size={18} />
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
