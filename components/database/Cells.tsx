"use client";

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Pencil, X, Paperclip, Link2, Upload, FileText } from 'lucide-react';
import type { DbColumn, DbSelectOption, OfficeMember, DbAttachment } from '@/lib/office-types';
import {
    colorVar,
    formatDate,
    formatNumber,
    formulaDisplay,
    initial,
    memberName,
    nextTagColor,
    uid,
} from './db-utils';
import styles from './Cells.module.css';

// ── Small shared pieces ─────────────────────────────────────────

export function Tag({ option }: { option: DbSelectOption }) {
    return (
        <span className={styles.tag} style={{ background: `color-mix(in srgb, ${colorVar(option.color)} 18%, transparent)` }}>
            <span className={styles.tagDot} style={{ background: colorVar(option.color) }} />
            {option.label}
        </span>
    );
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
    return (
        <span
            className={styles.avatar}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }}
            title={name}
        >
            {initial(name)}
        </span>
    );
}

function useClickOutside(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose]);
    return ref;
}

// ── Cell editor props ───────────────────────────────────────────

export interface CellEditorProps {
    column: DbColumn;
    value: unknown;
    rowData: Record<string, unknown>;
    schema: DbColumn[];
    members: OfficeMember[];
    onChange: (value: unknown) => void;
    onChangeSchema?: (schema: DbColumn[]) => void;
}

// ── Text ────────────────────────────────────────────────────────

function TextCell({ value, onChange }: CellEditorProps) {
    const [draft, setDraft] = useState(typeof value === 'string' ? value : value == null ? '' : String(value));
    const committed = useRef(draft);

    useEffect(() => {
        const external = typeof value === 'string' ? value : value == null ? '' : String(value);
        if (external !== committed.current) {
            setDraft(external);
            committed.current = external;
        }
    }, [value]);

    const commit = (next: string) => {
        committed.current = next;
        onChange(next);
    };

    return (
        <input
            className={styles.input}
            value={draft}
            placeholder="Empty"
            onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
        />
    );
}

// ── Number ──────────────────────────────────────────────────────

function NumberCell({ column, value, onChange }: CellEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const commit = () => {
        setEditing(false);
        if (draft.trim() === '') {
            onChange(null);
            return;
        }
        const num = parseFloat(draft);
        if (isFinite(num)) onChange(num);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                className={styles.input}
                type="number"
                step="any"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
            />
        );
    }

    const display = formatNumber(value, column.numberFormat);
    return (
        <div
            className={styles.display}
            onClick={() => {
                setDraft(value == null ? '' : String(value));
                setEditing(true);
            }}
        >
            {display || <span className={styles.placeholder}>Empty</span>}
        </div>
    );
}

// ── Select ──────────────────────────────────────────────────────

function SelectCell({ column, value, onChange, onChangeSchema, schema }: CellEditorProps) {
    const [open, setOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const ref = useClickOutside(open, () => setOpen(false));
    const options = column.options || [];
    const current = options.find(o => o.id === value);

    const createOption = () => {
        const label = newLabel.trim();
        if (!label || !onChangeSchema) return;
        const option: DbSelectOption = { id: uid(), label, color: nextTagColor(options) };
        onChangeSchema(schema.map(c => c.id === column.id ? { ...c, options: [...options, option] } : c));
        onChange(option.id);
        setNewLabel('');
        setOpen(false);
    };

    return (
        <div className={styles.cell} ref={ref}>
            <div className={styles.display} onClick={() => setOpen(o => !o)}>
                {current ? <Tag option={current} /> : <span className={styles.placeholder}>Empty</span>}
            </div>
            {open && (
                <div className={styles.dropdown}>
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            className={clsx(styles.dropdownItem, opt.id === value && styles.dropdownItemActive)}
                            onClick={() => { onChange(opt.id === value ? null : opt.id); setOpen(false); }}
                        >
                            <Tag option={opt} />
                            {opt.id === value && <span className={styles.dropdownCheck}><Check size={14} /></span>}
                        </button>
                    ))}
                    {current && (
                        <button className={clsx(styles.dropdownItem, styles.clearBtn)} onClick={() => { onChange(null); setOpen(false); }}>
                            <X size={13} /> Clear
                        </button>
                    )}
                    {onChangeSchema && (
                        <>
                            <div className={styles.dropdownDivider} />
                            <div className={styles.createInputRow}>
                                <input
                                    className={styles.createInput}
                                    value={newLabel}
                                    placeholder="New option…"
                                    onChange={e => setNewLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createOption(); }}
                                />
                                <button className={styles.createBtn} disabled={!newLabel.trim()} onClick={createOption}>
                                    Add
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Multi-select ────────────────────────────────────────────────

function MultiSelectCell({ column, value, onChange, onChangeSchema, schema }: CellEditorProps) {
    const [open, setOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const ref = useClickOutside(open, () => setOpen(false));
    const options = column.options || [];
    const selected: string[] = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    const selectedOptions = options.filter(o => selected.includes(o.id));

    const toggle = (optionId: string) => {
        const next = selected.includes(optionId) ? selected.filter(s => s !== optionId) : [...selected, optionId];
        onChange(next);
    };

    const createOption = () => {
        const label = newLabel.trim();
        if (!label || !onChangeSchema) return;
        const option: DbSelectOption = { id: uid(), label, color: nextTagColor(options) };
        onChangeSchema(schema.map(c => c.id === column.id ? { ...c, options: [...options, option] } : c));
        onChange([...selected, option.id]);
        setNewLabel('');
    };

    return (
        <div className={styles.cell} ref={ref}>
            <div className={styles.display} onClick={() => setOpen(o => !o)}>
                {selectedOptions.length > 0 ? (
                    <span className={styles.tagRow}>
                        {selectedOptions.map(opt => <Tag key={opt.id} option={opt} />)}
                    </span>
                ) : (
                    <span className={styles.placeholder}>Empty</span>
                )}
            </div>
            {open && (
                <div className={styles.dropdown}>
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            className={clsx(styles.dropdownItem, selected.includes(opt.id) && styles.dropdownItemActive)}
                            onClick={() => toggle(opt.id)}
                        >
                            <Tag option={opt} />
                            {selected.includes(opt.id) && <span className={styles.dropdownCheck}><Check size={14} /></span>}
                        </button>
                    ))}
                    {onChangeSchema && (
                        <>
                            <div className={styles.dropdownDivider} />
                            <div className={styles.createInputRow}>
                                <input
                                    className={styles.createInput}
                                    value={newLabel}
                                    placeholder="New option…"
                                    onChange={e => setNewLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createOption(); }}
                                />
                                <button className={styles.createBtn} disabled={!newLabel.trim()} onClick={createOption}>
                                    Add
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Date ────────────────────────────────────────────────────────

function DateCell({ value, onChange }: CellEditorProps) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                className={styles.input}
                type="date"
                value={typeof value === 'string' ? value : ''}
                onChange={e => onChange(e.target.value || null)}
                onBlur={() => setEditing(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
            />
        );
    }

    const display = formatDate(value);
    return (
        <div className={styles.display} onClick={() => setEditing(true)}>
            {display || <span className={styles.placeholder}>Empty</span>}
        </div>
    );
}

// ── Person ──────────────────────────────────────────────────────

function PersonCell({ value, onChange, members }: CellEditorProps) {
    const [open, setOpen] = useState(false);
    const ref = useClickOutside(open, () => setOpen(false));
    const name = memberName(members, value);

    return (
        <div className={styles.cell} ref={ref}>
            <div className={styles.display} onClick={() => setOpen(o => !o)}>
                {name ? (
                    <>
                        <Avatar name={name} />
                        <span className={styles.personName}>{name}</span>
                    </>
                ) : (
                    <span className={styles.placeholder}>Empty</span>
                )}
            </div>
            {open && (
                <div className={styles.dropdown}>
                    {members.map(m => (
                        <button
                            key={m.userId}
                            className={clsx(styles.dropdownItem, m.userId === value && styles.dropdownItemActive)}
                            onClick={() => { onChange(m.userId === value ? null : m.userId); setOpen(false); }}
                        >
                            <Avatar name={m.name} />
                            {m.name}
                            {m.userId === value && <span className={styles.dropdownCheck}><Check size={14} /></span>}
                        </button>
                    ))}
                    {name && (
                        <button className={clsx(styles.dropdownItem, styles.clearBtn)} onClick={() => { onChange(null); setOpen(false); }}>
                            <X size={13} /> Clear
                        </button>
                    )}
                    {members.length === 0 && <span className={styles.formula}>No members</span>}
                </div>
            )}
        </div>
    );
}

// ── Checkbox ────────────────────────────────────────────────────

function CheckboxCell({ value, onChange }: CellEditorProps) {
    return (
        <div className={styles.checkboxWrap}>
            <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(value)}
                onChange={e => onChange(e.target.checked)}
            />
        </div>
    );
}

// ── URL ─────────────────────────────────────────────────────────

function UrlCell({ value, onChange }: CellEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const url = typeof value === 'string' ? value : '';

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const commit = () => {
        setEditing(false);
        onChange(draft.trim() || null);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                className={styles.input}
                type="url"
                value={draft}
                placeholder="https://…"
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
            />
        );
    }

    if (!url) {
        return (
            <div className={styles.display} onClick={() => { setDraft(''); setEditing(true); }}>
                <span className={styles.placeholder}>Empty</span>
            </div>
        );
    }

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return (
        <div className={clsx(styles.cell, styles.display)} style={{ cursor: 'default' }}>
            <a className={styles.urlLink} href={href} target="_blank" rel="noopener noreferrer">
                {url}
            </a>
            <button className={styles.urlEditBtn} title="Edit URL" onClick={() => { setDraft(url); setEditing(true); }}>
                <Pencil size={12} />
            </button>
        </div>
    );
}

// ── Formula ─────────────────────────────────────────────────────

function FormulaCell({ column, schema, rowData }: CellEditorProps) {
    return <div className={styles.formula}>{formulaDisplay(column, schema, rowData)}</div>;
}

// ── Dispatcher ──────────────────────────────────────────────────

// ── Files / deliverables ────────────────────────────────────────

function normalizeAttachments(value: unknown): DbAttachment[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (a): a is DbAttachment => Boolean(a && typeof a === 'object' && typeof (a as DbAttachment).url === 'string')
    );
}

function FilesCell({ value, onChange }: CellEditorProps) {
    const [open, setOpen] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ref = useClickOutside(open, () => setOpen(false));

    const attachments = normalizeAttachments(value);

    const addLink = () => {
        let url = linkDraft.trim();
        if (!url || /^javascript:/i.test(url)) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        let name = url;
        try {
            name = new URL(url).hostname + new URL(url).pathname.replace(/\/$/, '');
        } catch {
            // keep raw url as name
        }
        onChange([...attachments, { id: uid(), name, url, kind: 'link' }]);
        setLinkDraft('');
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                setUploadError(data.error || 'Upload failed');
                return;
            }
            onChange([...attachments, { id: uid(), name: data.name, url: data.url, kind: 'file' }]);
        } catch {
            setUploadError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const remove = (id: string) => {
        onChange(attachments.filter(a => a.id !== id));
    };

    return (
        <div className={styles.filesWrap} ref={ref}>
            <button type="button" className={styles.filesTrigger} onClick={() => setOpen(o => !o)}>
                {attachments.length === 0 ? (
                    <span className={styles.placeholder}><Paperclip size={12} /> Attach</span>
                ) : (
                    <span className={styles.filesSummary}>
                        {attachments.slice(0, 2).map(a => (
                            <span key={a.id} className={styles.fileChip}>
                                {a.kind === 'link' ? <Link2 size={11} /> : <FileText size={11} />}
                                {a.name.length > 22 ? a.name.slice(0, 20) + '…' : a.name}
                            </span>
                        ))}
                        {attachments.length > 2 && <span className={styles.fileMore}>+{attachments.length - 2}</span>}
                    </span>
                )}
            </button>

            {open && (
                <div className={styles.filesMenu}>
                    {attachments.map(a => (
                        <div key={a.id} className={styles.fileRow}>
                            {a.kind === 'link' ? <Link2 size={13} /> : <FileText size={13} />}
                            <a href={a.url} target="_blank" rel="noreferrer" className={styles.fileLink} title={a.url}>
                                {a.name}
                            </a>
                            <button type="button" className={styles.fileRemove} onClick={() => remove(a.id)} aria-label={`Remove ${a.name}`}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {attachments.length === 0 && (
                        <div className={styles.filesEmpty}>No deliverables yet</div>
                    )}

                    <div className={styles.fileAddRow}>
                        <input
                            className={styles.fileLinkInput}
                            placeholder="Paste a link…"
                            value={linkDraft}
                            onChange={e => setLinkDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                        />
                        <button type="button" className={styles.fileAddBtn} onClick={addLink} disabled={!linkDraft.trim()}>
                            Add
                        </button>
                    </div>

                    <button
                        type="button"
                        className={styles.fileUploadBtn}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <Upload size={13} />
                        {uploading ? 'Uploading…' : 'Upload a document'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file);
                            e.target.value = '';
                        }}
                    />
                    {uploadError && <div className={styles.fileError}>{uploadError}</div>}
                </div>
            )}
        </div>
    );
}

export function CellEditor(props: CellEditorProps) {
    switch (props.column.type) {
        case 'text': return <TextCell {...props} />;
        case 'number': return <NumberCell {...props} />;
        case 'select': return <SelectCell {...props} />;
        case 'multiSelect': return <MultiSelectCell {...props} />;
        case 'date': return <DateCell {...props} />;
        case 'person': return <PersonCell {...props} />;
        case 'checkbox': return <CheckboxCell {...props} />;
        case 'url': return <UrlCell {...props} />;
        case 'formula': return <FormulaCell {...props} />;
        case 'files': return <FilesCell {...props} />;
        default: return <TextCell {...props} />;
    }
}
