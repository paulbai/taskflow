"use client";

import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import styles from './EmojiPicker.module.css';

const CATEGORIES: { name: string; emoji: string[] }[] = [
    {
        name: 'Smileys',
        emoji: ['😀', '😄', '😁', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '🙂', '😉', '😇', '🤗', '🤔', '😴', '🥳', '😢', '😭', '😡'],
    },
    {
        name: 'Gestures',
        emoji: ['👍', '👎', '👋', '🙌', '👏', '🙏', '💪', '🤝', '✌️', '🤞', '👀', '🧠'],
    },
    {
        name: 'Nature',
        emoji: ['🌱', '🌿', '🍀', '🌵', '🌸', '🌼', '🌞', '🌙', '⭐', '🔥', '🌈', '⚡', '❄️', '🌊', '🐶', '🐱', '🦊', '🐝', '🦋', '🐢'],
    },
    {
        name: 'Food',
        emoji: ['🍎', '🍌', '🍕', '🍔', '🌮', '🍣', '🍩', '🍪', '🎂', '☕', '🍵', '🥑', '🍇', '🍓', '🥕', '🍞'],
    },
    {
        name: 'Activities',
        emoji: ['⚽', '🏀', '🎾', '🎮', '🎲', '🎯', '🎸', '🎨', '🎬', '🎧', '🏆', '🥇', '🚀', '✈️', '🚗', '⛺'],
    },
    {
        name: 'Objects',
        emoji: ['💡', '📌', '📎', '✏️', '📝', '📚', '📖', '🔖', '📅', '📊', '📈', '💰', '🔑', '🔒', '⚙️', '🔍', '💻', '📱', '⏰', '🗂️'],
    },
    {
        name: 'Symbols',
        emoji: ['❤️', '🧡', '💛', '💚', '💙', '💜', '✅', '❌', '⚠️', '❓', '❗', '💯', '✨', '🎉', '🎊', '🔔'],
    },
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    onClose: () => void;
    align?: 'left' | 'right';
}

export function EmojiPicker({ onSelect, onClose, align = 'left' }: EmojiPickerProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Defer so the click that opened the picker doesn't immediately close it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', onDown);
            document.addEventListener('keydown', onKey);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div ref={ref} className={clsx(styles.picker, align === 'right' && styles.alignRight)}>
            {CATEGORIES.map(cat => (
                <div key={cat.name} className={styles.category}>
                    <div className={styles.categoryLabel}>{cat.name}</div>
                    <div className={styles.grid}>
                        {cat.emoji.map(emoji => (
                            <button
                                key={emoji}
                                type="button"
                                className={styles.emojiBtn}
                                onClick={() => onSelect(emoji)}
                                aria-label={`Select ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
