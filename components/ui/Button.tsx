import React from 'react';
import styles from './Button.module.css';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'danger' | 'default' | 'ghost';
    size?: 'default' | 'small';
}

export function Button({
    children,
    className,
    variant = 'default',
    size = 'default',
    ...props
}: ButtonProps) {
    return (
        <button
            className={clsx(
                styles.button,
                styles[variant],
                styles[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
