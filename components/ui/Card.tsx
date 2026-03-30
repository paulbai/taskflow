import React from 'react';
import styles from './Card.module.css';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
    return (
        <div className={clsx(styles.card, className)} {...props}>
            {children}
        </div>
    );
}
