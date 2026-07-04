"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
    Bold,
    Check,
    CheckSquare,
    ChevronRight,
    Code,
    Copy,
    Film,
    GripVertical,
    Heading1,
    Heading2,
    Heading3,
    Image as ImageIcon,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Megaphone,
    Minus,
    Plus,
    Quote,
    Strikethrough,
    Trash2,
    Type,
    Underline,
} from 'lucide-react';
import type { Block, BlockType } from '@/lib/office-types';
import { EmojiPicker } from './EmojiPicker';
import styles from './BlockEditor.module.css';

// ── Helpers ─────────────────────────────────────────────────────

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'blk_' + Math.random().toString(36).slice(2, 11);
}

export function makeBlock(type: BlockType = 'paragraph', content = '', props: Block['props'] = {}): Block {
    return { id: makeId(), type, content, props };
}

const TEXT_TYPES: BlockType[] = [
    'paragraph', 'heading1', 'heading2', 'heading3', 'bulletList',
    'numberedList', 'todo', 'toggle', 'quote', 'callout', 'code',
];

const LIST_TYPES: BlockType[] = ['bulletList', 'numberedList', 'todo'];

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
    paragraph: "Type '/' for commands",
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'List item',
    numberedList: 'List item',
    todo: 'To-do',
    toggle: 'Toggle',
    quote: 'Quote',
    callout: 'Type something…',
    code: 'Write some code…',
};

interface SlashItem {
    type: BlockType;
    label: string;
    keywords: string;
    icon: React.ElementType;
}

const SLASH_ITEMS: SlashItem[] = [
    { type: 'paragraph', label: 'Text', keywords: 'text paragraph plain p', icon: Type },
    { type: 'heading1', label: 'Heading 1', keywords: 'h1 heading big title', icon: Heading1 },
    { type: 'heading2', label: 'Heading 2', keywords: 'h2 heading medium subtitle', icon: Heading2 },
    { type: 'heading3', label: 'Heading 3', keywords: 'h3 heading small', icon: Heading3 },
    { type: 'bulletList', label: 'Bulleted list', keywords: 'bullet ul unordered list', icon: List },
    { type: 'numberedList', label: 'Numbered list', keywords: 'number ol ordered list', icon: ListOrdered },
    { type: 'todo', label: 'To-do list', keywords: 'todo task checkbox check', icon: CheckSquare },
    { type: 'toggle', label: 'Toggle', keywords: 'toggle collapse expand chevron', icon: ChevronRight },
    { type: 'quote', label: 'Quote', keywords: 'quote blockquote citation', icon: Quote },
    { type: 'callout', label: 'Callout', keywords: 'callout info note highlight', icon: Megaphone },
    { type: 'code', label: 'Code', keywords: 'code snippet monospace pre', icon: Code },
    { type: 'divider', label: 'Divider', keywords: 'divider hr line separator', icon: Minus },
    { type: 'image', label: 'Image', keywords: 'image picture photo img', icon: ImageIcon },
    { type: 'embed', label: 'Embed', keywords: 'embed iframe video youtube', icon: Film },
];

function caretAtStart(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return false;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length === 0;
}

function caretRect(el: HTMLElement): DOMRect {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).cloneRange();
        r.collapse(true);
        const rect = r.getBoundingClientRect();
        if (rect.top !== 0 || rect.left !== 0 || rect.width !== 0 || rect.height !== 0) {
            return rect;
        }
    }
    return el.getBoundingClientRect();
}

function placeCaret(el: HTMLElement, pos: 'start' | 'end' | number) {
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    if (pos === 'start' || pos === 'end') {
        range.selectNodeContents(el);
        range.collapse(pos === 'start');
    } else {
        let remaining = pos;
        let placed = false;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const len = (node.textContent || '').length;
            if (remaining <= len) {
                range.setStart(node, remaining);
                range.collapse(true);
                placed = true;
                break;
            }
            remaining -= len;
            node = walker.nextNode();
        }
        if (!placed) {
            range.selectNodeContents(el);
            range.collapse(false);
        }
    }
    sel.removeAllRanges();
    sel.addRange(range);
}

function htmlToText(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
}

// ── Component ───────────────────────────────────────────────────

interface BlockEditorProps {
    blocks: Block[];
    onChange: (blocks: Block[]) => void;
    workspaceSlug: string;
}

interface SlashState {
    blockId: string;
    x: number;
    y: number;
    query: string;
    index: number;
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editablesRef = useRef(new Map<string, HTMLElement>());
    const refCbsRef = useRef(new Map<string, (el: HTMLElement | null) => void>());
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;
    const versionsRef = useRef<Record<string, number>>({});
    const pendingFocusRef = useRef<{ id: string; pos: 'start' | 'end' | number } | null>(null);

    const [slash, setSlash] = useState<SlashState | null>(null);
    const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [calloutPickerId, setCalloutPickerId] = useState<string | null>(null);

    const slashMenuRef = useRef<HTMLDivElement>(null);

    const commit = useCallback((next: Block[]) => {
        onChange(next.length ? next : [makeBlock()]);
    }, [onChange]);

    const bumpVersion = useCallback((id: string) => {
        versionsRef.current[id] = (versionsRef.current[id] || 0) + 1;
    }, []);

    const focusBlock = useCallback((id: string, pos: 'start' | 'end' | number) => {
        pendingFocusRef.current = { id, pos };
    }, []);

    // Apply pending focus after render
    useEffect(() => {
        const pf = pendingFocusRef.current;
        if (!pf) return;
        const el = editablesRef.current.get(pf.id);
        if (!el) return;
        pendingFocusRef.current = null;
        placeCaret(el, pf.pos);
    });

    // Stable ref callbacks per block id; innerHTML written only on (re)mount
    const getEditableRef = useCallback((id: string) => {
        let cb = refCbsRef.current.get(id);
        if (!cb) {
            cb = (el: HTMLElement | null) => {
                if (el) {
                    editablesRef.current.set(id, el);
                    const b = blocksRef.current.find(x => x.id === id);
                    el.innerHTML = b ? b.content : '';
                } else {
                    editablesRef.current.delete(id);
                }
            };
            refCbsRef.current.set(id, cb);
        }
        return cb;
    }, []);

    // ── Selection toolbar ───────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                setToolbar(t => (t === null ? t : null));
                return;
            }
            const range = sel.getRangeAt(0);
            const container = containerRef.current;
            if (!container || !container.contains(range.commonAncestorContainer)) {
                setToolbar(t => (t === null ? t : null));
                return;
            }
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                setToolbar(t => (t === null ? t : null));
                return;
            }
            setToolbar({ x: rect.left + rect.width / 2, y: rect.top });
        };
        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, []);

    // Close slash menu on outside click
    useEffect(() => {
        if (!slash) return;
        const onDown = (e: MouseEvent) => {
            if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
                setSlash(null);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [slash]);

    const syncFromSelection = useCallback(() => {
        const sel = window.getSelection();
        let node: Node | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
        while (node) {
            if (node instanceof HTMLElement && node.dataset.blockId) {
                const id = node.dataset.blockId;
                const html = node.innerHTML;
                commit(blocksRef.current.map(b => (b.id === id ? { ...b, content: html } : b)));
                return;
            }
            node = node.parentNode;
        }
    }, [commit]);

    const exec = useCallback((command: string) => {
        document.execCommand(command);
        syncFromSelection();
    }, [syncFromSelection]);

    const applyLink = useCallback(() => {
        const input = window.prompt('Link URL');
        if (!input) return;
        let url = input.trim();
        if (!url || /^javascript:/i.test(url)) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        document.execCommand('createLink', false, url);
        syncFromSelection();
    }, [syncFromSelection]);

    const toggleInlineCode = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        // Find an ancestor <code> below the block root, if any
        let node: Node | null = sel.anchorNode;
        let codeEl: HTMLElement | null = null;
        while (node) {
            if (node instanceof HTMLElement) {
                if (node.dataset.blockId) break;
                if (node.tagName === 'CODE') {
                    codeEl = node;
                    break;
                }
            }
            node = node.parentNode;
        }
        if (codeEl && codeEl.parentNode) {
            const parent = codeEl.parentNode;
            while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
            parent.removeChild(codeEl);
        } else {
            const range = sel.getRangeAt(0);
            const code = document.createElement('code');
            try {
                range.surroundContents(code);
            } catch {
                code.appendChild(range.extractContents());
                range.insertNode(code);
            }
            sel.removeAllRanges();
            const nr = document.createRange();
            nr.selectNodeContents(code);
            sel.addRange(nr);
        }
        syncFromSelection();
    }, [syncFromSelection]);

    // ── Block operations ────────────────────────────────────────

    const insertBlockAfter = useCallback((afterId: string, block?: Block) => {
        const nb = block || makeBlock();
        const list = blocksRef.current;
        const idx = list.findIndex(b => b.id === afterId);
        const next = [...list];
        next.splice(idx + 1, 0, nb);
        commit(next);
        if (TEXT_TYPES.includes(nb.type)) focusBlock(nb.id, 'start');
    }, [commit, focusBlock]);

    const removeBlock = useCallback((id: string) => {
        const list = blocksRef.current;
        const idx = list.findIndex(b => b.id === id);
        for (let i = idx - 1; i >= 0; i--) {
            if (TEXT_TYPES.includes(list[i].type)) {
                focusBlock(list[i].id, 'end');
                break;
            }
        }
        commit(list.filter(b => b.id !== id));
    }, [commit, focusBlock]);

    const updateProps = useCallback((id: string, props: Partial<Block['props']>) => {
        commit(blocksRef.current.map(b => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)));
    }, [commit]);

    const applySlash = useCallback((blockId: string, type: BlockType) => {
        const block = blocksRef.current.find(b => b.id === blockId);
        const el = editablesRef.current.get(blockId);
        if (!block) return;
        // Strip the "/command" text from the DOM before reading content
        if (el) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
                const tn = sel.anchorNode as globalThis.Text;
                if (el.contains(tn)) {
                    const upto = sel.anchorOffset;
                    const idx = tn.data.lastIndexOf('/', Math.max(0, upto - 1));
                    if (idx !== -1) tn.deleteData(idx, upto - idx);
                }
            }
        }
        const content = el ? el.innerHTML : block.content;
        setSlash(null);
        bumpVersion(blockId);
        const props: Block['props'] = { ...block.props };
        if (type === 'todo') props.checked = false;
        if (type === 'toggle') props.collapsed = false;
        if (type === 'callout' && !props.emoji) props.emoji = '💡';
        commit(blocksRef.current.map(b => (
            b.id === blockId
                ? { ...b, type, content: type === 'divider' ? '' : content, props }
                : b
        )));
        if (TEXT_TYPES.includes(type)) focusBlock(blockId, 'end');
    }, [bumpVersion, commit, focusBlock]);

    // ── Input / keyboard handlers ───────────────────────────────

    const handleInput = (block: Block) => (e: React.FormEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const html = el.innerHTML;
        commit(blocksRef.current.map(b => (b.id === block.id ? { ...b, content: html } : b)));

        const text = el.textContent || '';
        const native = e.nativeEvent as InputEvent;
        if (slash && slash.blockId === block.id) {
            const idx = text.lastIndexOf('/');
            if (idx === -1) {
                setSlash(null);
            } else {
                setSlash({ ...slash, query: text.slice(idx + 1), index: 0 });
            }
        } else if (native && native.data === '/' && block.type !== 'code') {
            const rect = caretRect(el);
            setSlash({ blockId: block.id, x: rect.left, y: rect.bottom + 6, query: '', index: 0 });
        }
    };

    const slashItems = slash
        ? SLASH_ITEMS.filter(item => {
            const q = slash.query.trim().toLowerCase();
            if (!q) return true;
            return item.label.toLowerCase().includes(q) || item.keywords.includes(q);
        })
        : [];

    const handleKeyDown = (block: Block) => (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = e.currentTarget;

        if (slash && slash.blockId === block.id) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (slashItems.length) setSlash({ ...slash, index: (slash.index + 1) % slashItems.length });
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (slashItems.length) setSlash({ ...slash, index: (slash.index - 1 + slashItems.length) % slashItems.length });
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (slashItems.length) {
                    applySlash(block.id, slashItems[Math.min(slash.index, slashItems.length - 1)].type);
                } else {
                    setSlash(null);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSlash(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            if (block.type === 'code') {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                return;
            }
            e.preventDefault();
            const text = (el.textContent || '').trim();

            // Enter on an empty list item converts it to a paragraph
            if (LIST_TYPES.includes(block.type) && text === '') {
                bumpVersion(block.id);
                commit(blocksRef.current.map(b => (
                    b.id === block.id
                        ? { ...b, type: 'paragraph' as BlockType, props: { ...b.props, checked: undefined } }
                        : b
                )));
                focusBlock(block.id, 'start');
                return;
            }

            // Split at caret: trailing content moves into the new block
            let trailing = '';
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).endContainer)) {
                const range = sel.getRangeAt(0);
                const tail = range.cloneRange();
                tail.selectNodeContents(el);
                tail.setStart(range.endContainer, range.endOffset);
                const frag = tail.extractContents();
                const tmp = document.createElement('div');
                tmp.appendChild(frag);
                trailing = tmp.innerHTML;
            }
            const inherit: BlockType = LIST_TYPES.includes(block.type) ? block.type : 'paragraph';
            const nb = makeBlock(inherit, trailing, {
                indent: block.props.indent,
                ...(inherit === 'todo' ? { checked: false } : {}),
            });
            const currentHtml = el.innerHTML;
            const list = blocksRef.current;
            const idx = list.findIndex(b => b.id === block.id);
            const next = list.map(b => (b.id === block.id ? { ...b, content: currentHtml } : b));
            next.splice(idx + 1, 0, nb);
            commit(next);
            focusBlock(nb.id, 'start');
            return;
        }

        if (e.key === 'Backspace') {
            if (!caretAtStart(el)) return;
            e.preventDefault();
            const empty = (el.textContent || '').length === 0;

            if (block.type !== 'paragraph') {
                commit(blocksRef.current.map(b => (
                    b.id === block.id
                        ? { ...b, type: 'paragraph' as BlockType, props: { ...b.props, checked: undefined } }
                        : b
                )));
                focusBlock(block.id, 'start');
                return;
            }

            const list = blocksRef.current;
            const idx = list.findIndex(b => b.id === block.id);
            if (idx <= 0) return;
            const prev = list[idx - 1];

            if (empty) {
                removeBlock(block.id);
                return;
            }

            if (TEXT_TYPES.includes(prev.type) && prev.type !== 'code') {
                const junction = htmlToText(prev.content).length;
                bumpVersion(prev.id);
                const merged = list
                    .filter(b => b.id !== block.id)
                    .map(b => (b.id === prev.id ? { ...b, content: b.content + el.innerHTML } : b));
                commit(merged);
                focusBlock(prev.id, junction);
            } else {
                focusBlock(prev.id, 'end');
            }
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const cur = block.props.indent || 0;
            const next = e.shiftKey ? Math.max(0, cur - 1) : Math.min(4, cur + 1);
            if (next !== cur) updateProps(block.id, { indent: next });
            return;
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    // ── Drag and drop ───────────────────────────────────────────

    const handleDrop = useCallback(() => {
        if (dragId && dropTarget && dragId !== dropTarget.id) {
            const list = blocksRef.current;
            const dragged = list.find(b => b.id === dragId);
            if (dragged) {
                const rest = list.filter(b => b.id !== dragId);
                const ti = rest.findIndex(b => b.id === dropTarget.id);
                if (ti !== -1) {
                    rest.splice(ti + (dropTarget.after ? 1 : 0), 0, dragged);
                    commit(rest);
                }
            }
        }
        setDragId(null);
        setDropTarget(null);
    }, [dragId, dropTarget, commit]);

    const copyCode = useCallback(async (id: string) => {
        const el = editablesRef.current.get(id);
        if (!el) return;
        try {
            await navigator.clipboard.writeText(el.innerText);
            setCopiedId(id);
            setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
        } catch {
            // clipboard unavailable
        }
    }, []);

    // ── Derived render data ─────────────────────────────────────

    const hiddenIds = new Set<string>();
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.type === 'toggle' && b.props.collapsed) {
            const base = b.props.indent || 0;
            let j = i + 1;
            while (j < blocks.length && (blocks[j].props.indent || 0) > base) {
                hiddenIds.add(blocks[j].id);
                j++;
            }
        }
    }

    const numbers = new Map<string, number>();
    {
        const counters = new Map<number, number>();
        for (const b of blocks) {
            const ind = b.props.indent || 0;
            if (b.type === 'numberedList') {
                const n = (counters.get(ind) || 0) + 1;
                counters.set(ind, n);
                numbers.set(b.id, n);
                for (const k of Array.from(counters.keys())) {
                    if (k > ind) counters.delete(k);
                }
            } else {
                for (const k of Array.from(counters.keys())) {
                    if (k >= ind) counters.delete(k);
                }
            }
        }
    }

    // ── Render ──────────────────────────────────────────────────

    const renderEditable = (block: Block, className: string, alwaysPlaceholder = false) => (
        <div
            ref={getEditableRef(block.id) as React.Ref<HTMLDivElement>}
            className={clsx(styles.editable, className, alwaysPlaceholder && styles.alwaysPlaceholder)}
            contentEditable
            suppressContentEditableWarning
            data-block-id={block.id}
            data-placeholder={PLACEHOLDERS[block.type] || ''}
            onInput={handleInput(block)}
            onKeyDown={handleKeyDown(block)}
            onPaste={handlePaste}
            spellCheck
        />
    );

    const renderBody = (block: Block) => {
        switch (block.type) {
            case 'heading1':
                return renderEditable(block, styles.h1, true);
            case 'heading2':
                return renderEditable(block, styles.h2, true);
            case 'heading3':
                return renderEditable(block, styles.h3, true);
            case 'bulletList':
                return (
                    <div className={styles.listRow}>
                        <span className={styles.bulletDot} aria-hidden>•</span>
                        {renderEditable(block, styles.listText)}
                    </div>
                );
            case 'numberedList':
                return (
                    <div className={styles.listRow}>
                        <span className={styles.listNumber} aria-hidden>{numbers.get(block.id) || 1}.</span>
                        {renderEditable(block, styles.listText)}
                    </div>
                );
            case 'todo':
                return (
                    <div className={styles.listRow}>
                        <button
                            type="button"
                            className={clsx(styles.todoCheck, block.props.checked && styles.todoCheckOn)}
                            onClick={() => updateProps(block.id, { checked: !block.props.checked })}
                            aria-label={block.props.checked ? 'Mark incomplete' : 'Mark complete'}
                        >
                            {block.props.checked && <Check size={12} strokeWidth={3} />}
                        </button>
                        {renderEditable(block, clsx(styles.listText, block.props.checked && styles.todoDone))}
                    </div>
                );
            case 'toggle':
                return (
                    <div className={styles.listRow}>
                        <button
                            type="button"
                            className={clsx(styles.toggleBtn, !block.props.collapsed && styles.toggleOpen)}
                            onClick={() => updateProps(block.id, { collapsed: !block.props.collapsed })}
                            aria-label={block.props.collapsed ? 'Expand' : 'Collapse'}
                        >
                            <ChevronRight size={15} />
                        </button>
                        {renderEditable(block, clsx(styles.listText, styles.toggleText))}
                    </div>
                );
            case 'quote':
                return (
                    <div className={styles.quote}>
                        {renderEditable(block, styles.quoteText)}
                    </div>
                );
            case 'callout':
                return (
                    <div className={styles.callout}>
                        <div className={styles.calloutEmojiWrap}>
                            <button
                                type="button"
                                className={styles.calloutEmoji}
                                onClick={() => setCalloutPickerId(calloutPickerId === block.id ? null : block.id)}
                                aria-label="Change callout emoji"
                            >
                                {block.props.emoji || '💡'}
                            </button>
                            {calloutPickerId === block.id && (
                                <EmojiPicker
                                    onSelect={emoji => {
                                        updateProps(block.id, { emoji });
                                        setCalloutPickerId(null);
                                    }}
                                    onClose={() => setCalloutPickerId(null)}
                                />
                            )}
                        </div>
                        {renderEditable(block, styles.calloutText)}
                    </div>
                );
            case 'code':
                return (
                    <div className={styles.codeWrap}>
                        <button
                            type="button"
                            className={styles.copyBtn}
                            onClick={() => copyCode(block.id)}
                            aria-label="Copy code"
                        >
                            {copiedId === block.id ? <Check size={13} /> : <Copy size={13} />}
                            {copiedId === block.id ? 'Copied' : 'Copy'}
                        </button>
                        {renderEditable(block, styles.codeText)}
                    </div>
                );
            case 'divider':
                return (
                    <div
                        className={styles.divider}
                        tabIndex={0}
                        role="separator"
                        onKeyDown={e => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                                e.preventDefault();
                                removeBlock(block.id);
                            }
                        }}
                    >
                        <hr className={styles.dividerLine} />
                    </div>
                );
            case 'image':
                return block.props.url ? (
                    <div className={styles.mediaWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={block.props.url} alt="" className={styles.image} />
                        <button
                            type="button"
                            className={styles.mediaRemove}
                            onClick={() => removeBlock(block.id)}
                            aria-label="Remove image"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ) : (
                    <UrlInput
                        placeholder="Paste an image URL…"
                        buttonLabel="Add image"
                        icon={<ImageIcon size={15} />}
                        onSubmit={url => updateProps(block.id, { url })}
                    />
                );
            case 'embed':
                return block.props.url ? (
                    <div className={styles.mediaWrap}>
                        <div className={styles.embedFrame}>
                            <iframe
                                src={block.props.url}
                                className={styles.embedIframe}
                                title="Embedded content"
                                allowFullScreen
                                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                            />
                        </div>
                        <button
                            type="button"
                            className={styles.mediaRemove}
                            onClick={() => removeBlock(block.id)}
                            aria-label="Remove embed"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ) : (
                    <UrlInput
                        placeholder="Paste a URL to embed…"
                        buttonLabel="Embed"
                        icon={<Film size={15} />}
                        onSubmit={url => updateProps(block.id, { url })}
                    />
                );
            case 'paragraph':
            default:
                return renderEditable(block, styles.p);
        }
    };

    return (
        <div ref={containerRef} className={styles.editor}>
            {blocks.map(block => {
                const version = versionsRef.current[block.id] || 0;
                const indent = block.props.indent || 0;
                return (
                    <div
                        key={`${block.id}:${block.type}:${version}`}
                        className={clsx(
                            styles.blockRow,
                            hiddenIds.has(block.id) && styles.hiddenBlock,
                            dragId === block.id && styles.dragging,
                            dropTarget?.id === block.id && (dropTarget.after ? styles.dropAfter : styles.dropBefore),
                        )}
                        style={indent ? { marginLeft: indent * 26 } : undefined}
                        onDragOver={e => {
                            if (!dragId) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            const rect = e.currentTarget.getBoundingClientRect();
                            const after = e.clientY > rect.top + rect.height / 2;
                            setDropTarget(t => (
                                t && t.id === block.id && t.after === after ? t : { id: block.id, after }
                            ));
                        }}
                        onDrop={e => {
                            e.preventDefault();
                            handleDrop();
                        }}
                    >
                        <div className={styles.gutter} contentEditable={false}>
                            <button
                                type="button"
                                className={styles.gutterBtn}
                                onClick={() => insertBlockAfter(block.id)}
                                aria-label="Add block below"
                                tabIndex={-1}
                            >
                                <Plus size={15} />
                            </button>
                            <button
                                type="button"
                                className={clsx(styles.gutterBtn, styles.dragHandle)}
                                draggable
                                onDragStart={e => {
                                    e.dataTransfer.setData('text/plain', block.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDragId(block.id);
                                }}
                                onDragEnd={() => {
                                    setDragId(null);
                                    setDropTarget(null);
                                }}
                                aria-label="Drag to reorder"
                                tabIndex={-1}
                            >
                                <GripVertical size={15} />
                            </button>
                        </div>
                        <div className={styles.blockBody}>{renderBody(block)}</div>
                    </div>
                );
            })}

            <div
                className={styles.bottomPad}
                onClick={() => {
                    const last = blocksRef.current[blocksRef.current.length - 1];
                    if (last && last.type === 'paragraph' && htmlToText(last.content).trim() === '') {
                        focusBlock(last.id, 'end');
                        commit([...blocksRef.current]);
                    } else if (last) {
                        insertBlockAfter(last.id);
                    }
                }}
            />

            {slash && (
                <div
                    ref={slashMenuRef}
                    className={styles.slashMenu}
                    style={{ left: Math.min(slash.x, typeof window !== 'undefined' ? window.innerWidth - 280 : slash.x), top: slash.y }}
                >
                    {slashItems.length === 0 && <div className={styles.slashEmpty}>No results</div>}
                    {slashItems.map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.type}
                                type="button"
                                className={clsx(styles.slashItem, i === slash.index && styles.slashItemActive)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => applySlash(slash.blockId, item.type)}
                                onMouseEnter={() => setSlash(s => (s ? { ...s, index: i } : s))}
                            >
                                <span className={styles.slashIcon}><Icon size={16} /></span>
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {toolbar && (
                <div
                    className={styles.toolbar}
                    style={{ left: toolbar.x, top: toolbar.y }}
                    onMouseDown={e => e.preventDefault()}
                >
                    <button type="button" className={styles.toolbarBtn} onClick={() => exec('bold')} aria-label="Bold">
                        <Bold size={15} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} onClick={() => exec('italic')} aria-label="Italic">
                        <Italic size={15} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} onClick={() => exec('underline')} aria-label="Underline">
                        <Underline size={15} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} onClick={() => exec('strikeThrough')} aria-label="Strikethrough">
                        <Strikethrough size={15} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} onClick={toggleInlineCode} aria-label="Inline code">
                        <Code size={15} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} onClick={applyLink} aria-label="Add link">
                        <LinkIcon size={15} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── URL input for image / embed blocks ──────────────────────────

function UrlInput({ placeholder, buttonLabel, icon, onSubmit }: {
    placeholder: string;
    buttonLabel: string;
    icon: React.ReactNode;
    onSubmit: (url: string) => void;
}) {
    const [value, setValue] = useState('');
    return (
        <form
            className={styles.urlForm}
            onSubmit={e => {
                e.preventDefault();
                const url = value.trim();
                if (!url || /^javascript:/i.test(url)) return;
                onSubmit(/^https?:\/\//i.test(url) ? url : 'https://' + url);
            }}
        >
            <span className={styles.urlIcon}>{icon}</span>
            <input
                className={styles.urlInput}
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={e => setValue(e.target.value)}
                autoFocus
            />
            <button type="submit" className={styles.urlSubmit}>{buttonLabel}</button>
        </form>
    );
}
