// Shared helpers for database views

import type { DbColumn, DbFull, DbRow, DbSelectOption, OfficeMember } from '@/lib/office-types';

export interface ViewProps {
    db: DbFull;
    rows: DbRow[];
    members: OfficeMember[];
    onUpdateRow: (rowId: string, data: Record<string, unknown>) => void;
    onCreateRow: (data: Record<string, unknown>) => void;
    onDeleteRow: (rowId: string) => void;
    onUpdateSchema: (schema: DbColumn[]) => void;
}

export function uid(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Colors ──────────────────────────────────────────────────────

export const TAG_COLORS = ['orange', 'yellow', 'blue', 'coral', 'purple', 'teal'] as const;

export function colorVar(color: string | undefined): string {
    if (color && (TAG_COLORS as readonly string[]).includes(color)) {
        return `var(--card-${color})`;
    }
    return 'var(--accent)';
}

export function nextTagColor(existing: DbSelectOption[]): string {
    return TAG_COLORS[existing.length % TAG_COLORS.length];
}

// ── Column helpers ──────────────────────────────────────────────

export function firstColumnOfType(schema: DbColumn[], type: DbColumn['type']): DbColumn | undefined {
    return schema.find(c => c.type === type);
}

export function titleColumn(schema: DbColumn[]): DbColumn | undefined {
    return schema.find(c => c.type === 'text') || schema[0];
}

export function rowTitle(row: DbRow, schema: DbColumn[]): string {
    const col = titleColumn(schema);
    const value = col ? row.data[col.id] : undefined;
    const str = typeof value === 'string' ? value.trim() : value !== undefined && value !== null ? String(value) : '';
    return str || 'Untitled';
}

export function optionForValue(col: DbColumn | undefined, value: unknown): DbSelectOption | undefined {
    if (!col?.options || typeof value !== 'string') return undefined;
    return col.options.find(o => o.id === value);
}

// ── Formatting ──────────────────────────────────────────────────

export function formatNumber(value: unknown, format?: DbColumn['numberFormat']): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!isFinite(num)) return '';
    switch (format) {
        case 'integer':
            return Math.round(num).toLocaleString('en-GB');
        case 'currency':
            return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case 'decimal':
            return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        default:
            return num.toLocaleString('en-GB', { maximumFractionDigits: 4 });
    }
}

export function formatDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    const d = new Date(value + (value.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function looksLikeImage(url: unknown): boolean {
    if (typeof url !== 'string' || !url) return false;
    if (url.startsWith('data:image/')) return true;
    if (!/^https?:\/\//i.test(url)) return false;
    return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url)
        || /(images\.unsplash\.com|picsum\.photos|placehold)/i.test(url);
}

export function memberName(members: OfficeMember[], userId: unknown): string {
    if (typeof userId !== 'string' || !userId) return '';
    const m = members.find(mm => mm.userId === userId);
    return m ? m.name : '';
}

export function initial(name: string): string {
    return (name.trim()[0] || '?').toUpperCase();
}

// ── Formula evaluator (no eval) ─────────────────────────────────
// Supports {Column Name} references, + - * / and parentheses.

function numericValue(col: DbColumn | undefined, raw: unknown): number {
    if (col?.type === 'checkbox') return raw ? 1 : 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    const parsed = parseFloat(String(raw ?? ''));
    return isFinite(parsed) ? parsed : 0;
}

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

function tokenize(expr: string): Token[] | null {
    const tokens: Token[] = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if ('+-*/()'.includes(ch)) {
            tokens.push({ kind: 'op', value: ch });
            i++;
            continue;
        }
        if (/[0-9.]/.test(ch)) {
            let j = i;
            while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
            const num = parseFloat(expr.slice(i, j));
            if (!isFinite(num)) return null;
            tokens.push({ kind: 'num', value: num });
            i = j;
            continue;
        }
        return null; // unexpected character
    }
    return tokens;
}

class Parser {
    private pos = 0;
    constructor(private tokens: Token[]) {}

    private peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    private isOp(value: string): boolean {
        const t = this.peek();
        return !!t && t.kind === 'op' && t.value === value;
    }

    parse(): number | null {
        const result = this.expression();
        if (result === null || this.pos !== this.tokens.length) return null;
        return result;
    }

    private expression(): number | null {
        let left = this.term();
        if (left === null) return null;
        while (this.isOp('+') || this.isOp('-')) {
            const op = (this.tokens[this.pos] as { value: string }).value;
            this.pos++;
            const right = this.term();
            if (right === null) return null;
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }

    private term(): number | null {
        let left = this.factor();
        if (left === null) return null;
        while (this.isOp('*') || this.isOp('/')) {
            const op = (this.tokens[this.pos] as { value: string }).value;
            this.pos++;
            const right = this.factor();
            if (right === null) return null;
            left = op === '*' ? left * right : right === 0 ? NaN : left / right;
        }
        return left;
    }

    private factor(): number | null {
        const t = this.peek();
        if (!t) return null;
        if (t.kind === 'op' && t.value === '-') {
            this.pos++;
            const inner = this.factor();
            return inner === null ? null : -inner;
        }
        if (t.kind === 'op' && t.value === '+') {
            this.pos++;
            return this.factor();
        }
        if (t.kind === 'op' && t.value === '(') {
            this.pos++;
            const inner = this.expression();
            if (inner === null || !this.isOp(')')) return null;
            this.pos++;
            return inner;
        }
        if (t.kind === 'num') {
            this.pos++;
            return t.value;
        }
        return null;
    }
}

export function evaluateFormula(
    formula: string | undefined,
    schema: DbColumn[],
    rowData: Record<string, unknown>
): number | null {
    if (!formula || !formula.trim()) return null;
    const substituted = formula.replace(/\{([^{}]+)\}/g, (_match, rawName: string) => {
        const name = rawName.trim().toLowerCase();
        const col = schema.find(c => c.name.trim().toLowerCase() === name);
        if (!col) return ' 0 ';
        return ' ' + String(numericValue(col, rowData[col.id])) + ' ';
    });
    const tokens = tokenize(substituted);
    if (!tokens || tokens.length === 0) return null;
    const result = new Parser(tokens).parse();
    if (result === null || !isFinite(result)) return null;
    return result;
}

export function formulaDisplay(col: DbColumn, schema: DbColumn[], rowData: Record<string, unknown>): string {
    const result = evaluateFormula(col.formula, schema, rowData);
    if (result === null) return '—';
    return formatNumber(result, col.numberFormat);
}
