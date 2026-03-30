import React from 'react';
import styles from './Checkbox.module.css';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    checkboxSize?: 'default' | 'small';
    colored?: boolean;
}

export function Checkbox({ className, checkboxSize = 'default', colored = false, ...props }: CheckboxProps) {
    return (
        <label className={clsx(styles.checkboxContainer, styles[checkboxSize], colored && styles.colored, className)}>
            <input type="checkbox" {...props} />
            <span className={styles.checkmark}>
                {props.checked && <Check size={checkboxSize === 'small' ? 12 : 16} strokeWidth={3} />}
            </span>
        </label>
    );
}
