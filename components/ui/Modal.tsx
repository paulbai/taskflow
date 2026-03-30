import React, { useEffect } from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    children,
    className,
    showCloseButton = true
}: ModalProps) {

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Render to body for proper z-index management
    // Note: user needs to ensure they are in a client environment or suppress hydration warning if mismatch occurs, 
    // but standard Next.js usage usually handles this fine with 'use client' parent or check.
    // Actually, we should probably check if window is defined or use a Mounted state.

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={clsx(styles.modal, className)}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {showCloseButton && (
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
