"use client";

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Filter,
    Layers,
    Pencil,
    Plus,
    Sigma,
    Trash2,
    X,
} from 'lucide-react';
import type { DbColumn, DbColumnType, DbRow } from '@/lib/office-types';
import { CellEditor } from './Cells';
import { COLUMN_TYPE_LABELS, ColumnTypeIcon } from './column-icons';
import { colorVar, evaluateFormula, memberName, optionForValue, uid, type ViewProps } from './db-utils';
import styles from './TableView.module.css';

// ── Filtering model ─────────────────────────────────────────────

interface FilterDef {
    id: string;
    columnId: string;
    operator: string;
    value: string;
}

interface SortDef {
    columnId: string;
    dir: 'asc' | 'desc';
}

interface OperatorDef {
    id: string;
    label: string;
    needsValue: boolean;
}

function operatorsFor(type: DbColumnType): OperatorDef[] {
    switch (type) {
        case 'number':
        case 'formula':
            return [
                { id: 'eq', label: '=', needsValue: true },
                { id: 'gt', label: '>', needsValue: true },
                { id: 'lt', label: '<', needsValue: true },
                { id: 'isEmpty', label: 'is empty', needsValue: false },
                { id: 'isNotEmpty', label: 'is not empty', needsValue: false },
            ];
        case 'checkbox':
            return [
                { id: 'checked', label: 'is checked', needsValue: false },
                { id: 'unchecked', label: 'is unchecked', needsValue: false },
            ];
        case 'select':
        case 'multiSelect':
        case 'person':
            return [
                { id: 'is', label: 'is', needsValue: true },
                { id: 'isEmpty', label: 'is empty', needsValue: false },
                { id: 'isNotEmpty', label: 'is not empty', needsValue: false },
            ];
        default:
            return [
                { id: 'contains', label: 'contains', needsValue: true },
                { id: 'equals', label: 'equals', needsValue: true },
                { id: 'isEmpty', label: 'is empty', needsValue: false },
                { id: 'isNotEmpty', label: 'is not empty', needsValue: false },
            ];
    }
}

function isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

// ── Component ───────────────────────────────────────────────────

export function TableView({ db, rows, members, onUpdateRow, onCreateRow, onDeleteRow, onUpdateSchema }: ViewProps) {
    const schema = db.schema;
    const [sort, setSort] = useState<SortDef | null>(null);
    const [filters, setFilters] = useState<FilterDef[]>([]);
    const [groupBy, setGroupBy] = useState<string>('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [openMenu, setOpenMenu] = useState<string>(''); // column id | 'filter' | 'group'
    const [typePickerFor, setTypePickerFor] = useState<string>('');

    useEffect(() => {
        if (!openMenu) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element | null;
            if (target && target.closest('[data-db-menu]')) return;
            setOpenMenu('');
            setTypePickerFor('');
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openMenu]);

    const selectColumns = schema.filter(c => c.type === 'select');
    const groupColumn = selectColumns.find(c => c.id === groupBy);

    // ── Derived rows ────────────────────────────────────────────

    const comparable = (col: DbColumn, row: DbRow): number | string => {
        const raw = row.data[col.id];
        switch (col.type) {
            case 'number':
                return typeof raw === 'number' ? raw : parseFloat(String(raw ?? '')) || 0;
            case 'checkbox':
                return raw ? 1 : 0;
            case 'formula':
                return evaluateFormula(col.formula, schema, row.data) ?? 0;
            case 'select':
                return (optionForValue(col, raw)?.label || '').toLowerCase();
            case 'multiSelect': {
                const ids = Array.isArray(raw) ? raw : [];
                return ids
                    .map(id => col.options?.find(o => o.id === id)?.label || '')
                    .join(', ')
                    .toLowerCase();
            }
            case 'person':
                return memberName(members, raw).toLowerCase();
            default:
                return String(raw ?? '').toLowerCase();
        }
    };

    const matchesFilter = (row: DbRow, filter: FilterDef): boolean => {
        const col = schema.find(c => c.id === filter.columnId);
        if (!col) return true;
        const raw = row.data[col.id];
        switch (filter.operator) {
            case 'isEmpty': return isEmptyValue(raw);
            case 'isNotEmpty': return !isEmptyValue(raw);
            case 'checked': return Boolean(raw);
            case 'unchecked': return !raw;
            case 'is':
                if (col.type === 'multiSelect') {
                    return Array.isArray(raw) && raw.includes(filter.value);
                }
                return raw === filter.value;
            case 'eq':
            case 'gt':
            case 'lt': {
                const cellNum = col.type === 'formula'
                    ? evaluateFormula(col.formula, schema, row.data)
                    : typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
                const target = parseFloat(filter.value);
                if (cellNum === null || !isFinite(cellNum ?? NaN) || !isFinite(target)) return false;
                if (filter.operator === 'eq') return cellNum === target;
                if (filter.operator === 'gt') return cellNum > target;
                return cellNum < target;
            }
            case 'contains':
                return String(comparable(col, row)).includes(filter.value.toLowerCase());
            case 'equals':
                return String(comparable(col, row)) === filter.value.toLowerCase();
            default:
                return true;
        }
    };

    const visibleRows = useMemo(() => {
        let result = rows.filter(row => filters.every(f => matchesFilter(row, f)));
        if (sort) {
            const col = schema.find(c => c.id === sort.columnId);
            if (col) {
                const factor = sort.dir === 'asc' ? 1 : -1;
                result = [...result].sort((a, b) => {
                    const av = comparable(col, a);
                    const bv = comparable(col, b);
                    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
                    return String(av).localeCompare(String(bv)) * factor;
                });
            }
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, filters, sort, schema, members]);

    const groups = useMemo(() => {
        if (!groupColumn) return null;
        const options = groupColumn.options || [];
        const result: { key: string; label: string; color?: string; rows: DbRow[] }[] = options.map(opt => ({
            key: opt.id,
            label: opt.label,
            color: opt.color,
            rows: visibleRows.filter(r => r.data[groupColumn.id] === opt.id),
        }));
        result.push({
            key: '__none__',
            label: 'No ' + groupColumn.name.toLowerCase(),
            rows: visibleRows.filter(r => !options.some(o => o.id === r.data[groupColumn.id])),
        });
        return result;
    }, [groupColumn, visibleRows]);

    // ── Schema operations ───────────────────────────────────────

    const patchColumn = (columnId: string, patch: Partial<DbColumn>) => {
        onUpdateSchema(schema.map(c => c.id === columnId ? { ...c, ...patch } : c));
    };

    const addColumn = () => {
        const name = window.prompt('Column name');
        if (!name?.trim()) return;
        onUpdateSchema([...schema, { id: uid(), name: name.trim(), type: 'text' }]);
    };

    const renameColumn = (col: DbColumn) => {
        const name = window.prompt('Rename column', col.name);
        if (!name?.trim()) return;
        patchColumn(col.id, { name: name.trim() });
        setOpenMenu('');
    };

    const changeType = (col: DbColumn, type: DbColumnType) => {
        const patch: Partial<DbColumn> = { type };
        if ((type === 'select' || type === 'multiSelect') && !col.options) patch.options = [];
        if (type === 'formula' && !col.formula) {
            const formula = window.prompt('Formula (reference columns like {Price} * {Qty})', col.formula || '');
            if (formula !== null) patch.formula = formula;
        }
        patchColumn(col.id, patch);
        setOpenMenu('');
        setTypePickerFor('');
    };

    const editFormula = (col: DbColumn) => {
        const formula = window.prompt('Formula (reference columns like {Price} * {Qty})', col.formula || '');
        if (formula === null) return;
        patchColumn(col.id, { formula });
        setOpenMenu('');
    };

    const addSelectOption = (col: DbColumn) => {
        const label = window.prompt('New option label');
        if (!label?.trim()) return;
        const options = col.options || [];
        const colors = ['orange', 'yellow', 'blue', 'coral', 'purple', 'teal'];
        patchColumn(col.id, {
            options: [...options, { id: uid(), label: label.trim(), color: colors[options.length % colors.length] }],
        });
        setOpenMenu('');
    };

    const deleteColumn = (col: DbColumn) => {
        if (!window.confirm(`Delete column “${col.name}”?`)) return;
        onUpdateSchema(schema.filter(c => c.id !== col.id));
        setFilters(f => f.filter(x => x.columnId !== col.id));
        if (sort?.columnId === col.id) setSort(null);
        if (groupBy === col.id) setGroupBy('');
        setOpenMenu('');
    };

    const addFilterFor = (col: DbColumn) => {
        const ops = operatorsFor(col.type);
        setFilters(f => [...f, { id: uid(), columnId: col.id, operator: ops[0].id, value: '' }]);
        setOpenMenu('');
    };

    // ── Rendering helpers ───────────────────────────────────────

    const renderFilterValueInput = (filter: FilterDef, col: DbColumn) => {
        const update = (value: string) => setFilters(fs => fs.map(f => f.id === filter.id ? { ...f, value } : f));
        if (col.type === 'select' || col.type === 'multiSelect') {
            return (
                <select className={styles.menuSelect} value={filter.value} onChange={e => update(e.target.value)}>
                    <option value="">Pick option…</option>
                    {(col.options || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
            );
        }
        if (col.type === 'person') {
            return (
                <select className={styles.menuSelect} value={filter.value} onChange={e => update(e.target.value)}>
                    <option value="">Pick member…</option>
                    {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                </select>
            );
        }
        return (
            <input
                className={styles.menuInput}
                type={col.type === 'number' || col.type === 'formula' ? 'number' : 'text'}
                value={filter.value}
                placeholder="Value…"
                onChange={e => update(e.target.value)}
            />
        );
    };

    const filterChipLabel = (filter: FilterDef): string => {
        const col = schema.find(c => c.id === filter.columnId);
        if (!col) return '?';
        const op = operatorsFor(col.type).find(o => o.id === filter.operator);
        let valueLabel = filter.value;
        if (col.type === 'select' || col.type === 'multiSelect') {
            valueLabel = col.options?.find(o => o.id === filter.value)?.label || '';
        } else if (col.type === 'person') {
            valueLabel = memberName(members, filter.value);
        }
        return `${col.name} ${op?.label || ''}${op?.needsValue ? ' ' + (valueLabel || '…') : ''}`;
    };

    const renderRow = (row: DbRow) => (
        <tr key={row.id} className={styles.row}>
            {schema.map(col => (
                <td key={col.id} className={styles.td}>
                    <CellEditor
                        column={col}
                        value={row.data[col.id]}
                        rowData={row.data}
                        schema={schema}
                        members={members}
                        onChange={value => onUpdateRow(row.id, { [col.id]: value })}
                        onChangeSchema={onUpdateSchema}
                    />
                </td>
            ))}
            <td className={clsx(styles.td, styles.tdAction)}>
                <button className={styles.deleteRowBtn} title="Delete row" onClick={() => onDeleteRow(row.id)}>
                    <Trash2 size={14} />
                </button>
            </td>
        </tr>
    );

    const newRowButton = (extraData?: Record<string, unknown>) => (
        <tr>
            <td className={styles.td} colSpan={schema.length + 1}>
                <button className={styles.newRowBtn} onClick={() => onCreateRow(extraData || {})}>
                    <Plus size={14} />
                    New row
                </button>
            </td>
        </tr>
    );

    const totalColumns = schema.length + 1;

    return (
        <div className={styles.wrap}>
            <div className={styles.toolbar}>
                <div className={styles.menuAnchor} data-db-menu>
                    <button
                        className={clsx(styles.toolbarBtn, filters.length > 0 && styles.toolbarBtnActive)}
                        onClick={() => setOpenMenu(m => m === 'filter' ? '' : 'filter')}
                    >
                        <Filter size={13} />
                        Filter
                    </button>
                    {openMenu === 'filter' && (
                        <div className={styles.menu}>
                            <div className={styles.menuLabel}>Filter by column</div>
                            {schema.map(col => (
                                <button key={col.id} className={styles.menuItem} onClick={() => addFilterFor(col)}>
                                    <ColumnTypeIcon type={col.type} size={13} />
                                    {col.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className={styles.menuAnchor} data-db-menu>
                    <button
                        className={clsx(styles.toolbarBtn, groupColumn && styles.toolbarBtnActive)}
                        onClick={() => setOpenMenu(m => m === 'group' ? '' : 'group')}
                    >
                        <Layers size={13} />
                        {groupColumn ? `Grouped by ${groupColumn.name}` : 'Group'}
                    </button>
                    {openMenu === 'group' && (
                        <div className={styles.menu}>
                            <div className={styles.menuLabel}>Group by select column</div>
                            {selectColumns.length === 0 && (
                                <span className={styles.menuItem} style={{ cursor: 'default', color: 'var(--text-tertiary)' }}>
                                    No select columns
                                </span>
                            )}
                            {selectColumns.map(col => (
                                <button
                                    key={col.id}
                                    className={clsx(styles.menuItem, groupBy === col.id && styles.menuItemActive)}
                                    onClick={() => { setGroupBy(col.id); setOpenMenu(''); }}
                                >
                                    <ColumnTypeIcon type={col.type} size={13} />
                                    {col.name}
                                </button>
                            ))}
                            {groupBy && (
                                <>
                                    <div className={styles.menuDivider} />
                                    <button className={styles.menuItem} onClick={() => { setGroupBy(''); setOpenMenu(''); }}>
                                        <X size={13} />
                                        Remove grouping
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {filters.map(filter => {
                    const col = schema.find(c => c.id === filter.columnId);
                    if (!col) return null;
                    const ops = operatorsFor(col.type);
                    const op = ops.find(o => o.id === filter.operator);
                    return (
                        <span key={filter.id} className={styles.filterChip}>
                            {col.name}
                            <select
                                className={styles.menuSelect}
                                style={{ margin: 0 }}
                                value={filter.operator}
                                onChange={e => setFilters(fs => fs.map(f => f.id === filter.id ? { ...f, operator: e.target.value } : f))}
                            >
                                {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>
                            {op?.needsValue && renderFilterValueInput(filter, col)}
                            <button className={styles.chipRemove} onClick={() => setFilters(fs => fs.filter(f => f.id !== filter.id))}>
                                <X size={13} />
                            </button>
                        </span>
                    );
                })}
            </div>

            <div className={styles.tableScroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {schema.map(col => (
                                <th
                                    key={col.id}
                                    className={clsx(styles.th, col.type === 'checkbox' && styles.thCheckbox)}
                                    data-db-menu
                                >
                                    <button className={styles.thBtn} onClick={() => setOpenMenu(m => m === col.id ? '' : col.id)}>
                                        <ColumnTypeIcon type={col.type} size={13} />
                                        {col.name}
                                        {sort?.columnId === col.id && (
                                            <span className={styles.thSortIcon}>
                                                {sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                            </span>
                                        )}
                                    </button>
                                    {openMenu === col.id && (
                                        <div className={styles.menu}>
                                            <button className={styles.menuItem} onClick={() => { setSort({ columnId: col.id, dir: 'asc' }); setOpenMenu(''); }}>
                                                <ArrowUp size={13} /> Sort ascending
                                            </button>
                                            <button className={styles.menuItem} onClick={() => { setSort({ columnId: col.id, dir: 'desc' }); setOpenMenu(''); }}>
                                                <ArrowDown size={13} /> Sort descending
                                            </button>
                                            {sort?.columnId === col.id && (
                                                <button className={styles.menuItem} onClick={() => { setSort(null); setOpenMenu(''); }}>
                                                    <X size={13} /> Clear sort
                                                </button>
                                            )}
                                            <button className={styles.menuItem} onClick={() => addFilterFor(col)}>
                                                <Filter size={13} /> Filter
                                            </button>
                                            <div className={styles.menuDivider} />
                                            <button className={styles.menuItem} onClick={() => renameColumn(col)}>
                                                <Pencil size={13} /> Rename
                                            </button>
                                            <button
                                                className={styles.menuItem}
                                                onClick={() => setTypePickerFor(t => t === col.id ? '' : col.id)}
                                            >
                                                <ChevronRight size={13} style={typePickerFor === col.id ? { transform: 'rotate(90deg)' } : undefined} />
                                                Change type
                                            </button>
                                            {typePickerFor === col.id && (
                                                (Object.keys(COLUMN_TYPE_LABELS) as DbColumnType[]).map(type => (
                                                    <button
                                                        key={type}
                                                        className={clsx(styles.menuItem, col.type === type && styles.menuItemActive)}
                                                        style={{ paddingLeft: 26 }}
                                                        onClick={() => changeType(col, type)}
                                                    >
                                                        <ColumnTypeIcon type={type} size={13} />
                                                        {COLUMN_TYPE_LABELS[type]}
                                                    </button>
                                                ))
                                            )}
                                            {(col.type === 'select' || col.type === 'multiSelect') && (
                                                <button className={styles.menuItem} onClick={() => addSelectOption(col)}>
                                                    <Plus size={13} /> Add option
                                                </button>
                                            )}
                                            {col.type === 'formula' && (
                                                <button className={styles.menuItem} onClick={() => editFormula(col)}>
                                                    <Sigma size={13} /> Edit formula
                                                </button>
                                            )}
                                            {(col.type === 'number' || col.type === 'formula') && (
                                                <>
                                                    <div className={styles.menuLabel}>Number format</div>
                                                    {(['integer', 'decimal', 'currency'] as const).map(fmt => (
                                                        <button
                                                            key={fmt}
                                                            className={clsx(styles.menuItem, col.numberFormat === fmt && styles.menuItemActive)}
                                                            onClick={() => { patchColumn(col.id, { numberFormat: fmt }); setOpenMenu(''); }}
                                                        >
                                                            {fmt === 'currency' ? 'Currency (£)' : fmt[0].toUpperCase() + fmt.slice(1)}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            <div className={styles.menuDivider} />
                                            <button className={clsx(styles.menuItem, styles.menuItemDanger)} onClick={() => deleteColumn(col)}>
                                                <Trash2 size={13} /> Delete column
                                            </button>
                                        </div>
                                    )}
                                </th>
                            ))}
                            <th className={clsx(styles.th, styles.thAction)}>
                                <button className={styles.addColBtn} title="Add column" onClick={addColumn}>
                                    <Plus size={15} />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups ? (
                            <>
                                {groups.map(group => (
                                    <React.Fragment key={group.key}>
                                        <tr>
                                            <td className={styles.groupHeaderCell} colSpan={totalColumns}>
                                                <button
                                                    className={styles.groupHeaderBtn}
                                                    onClick={() => setCollapsed(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(group.key)) next.delete(group.key);
                                                        else next.add(group.key);
                                                        return next;
                                                    })}
                                                >
                                                    {collapsed.has(group.key) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                    <span
                                                        className={styles.groupDot}
                                                        style={{ background: group.color ? colorVar(group.color) : 'var(--text-disabled)' }}
                                                    />
                                                    {group.label}
                                                    <span className={styles.groupCount}>{group.rows.length}</span>
                                                </button>
                                            </td>
                                        </tr>
                                        {!collapsed.has(group.key) && group.rows.map(renderRow)}
                                        {!collapsed.has(group.key) && groupColumn && newRowButton(
                                            group.key === '__none__' ? {} : { [groupColumn.id]: group.key }
                                        )}
                                    </React.Fragment>
                                ))}
                            </>
                        ) : (
                            <>
                                {visibleRows.map(renderRow)}
                                {visibleRows.length === 0 && (
                                    <tr>
                                        <td className={styles.empty} colSpan={totalColumns}>
                                            {rows.length === 0 ? 'No rows yet' : 'No rows match the current filters'}
                                        </td>
                                    </tr>
                                )}
                                {newRowButton()}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.footer}>
                {visibleRows.length === rows.length
                    ? `${rows.length} row${rows.length === 1 ? '' : 's'}`
                    : `${visibleRows.length} of ${rows.length} rows`}
            </div>
        </div>
    );
}
