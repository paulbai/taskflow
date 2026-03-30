import React, { forwardRef } from 'react';
import styles from './Input.module.css';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, id, ...props }, ref) => {
        const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

        return (
            <div className={styles.inputWrapper}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                    </label>
                )}
                <input
                    id={inputId}
                    ref={ref}
                    className={clsx(styles.input, className)}
                    {...props}
                />
            </div>
        );
    }
);

Input.displayName = 'Input';
