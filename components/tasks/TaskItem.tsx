import React from 'react';
import styles from './TaskItem.module.css';
import { Checkbox } from '../ui/Checkbox';
import { Task } from '../../types';
import { clsx } from 'clsx';
import { Calendar, Tag, ChevronRight } from 'lucide-react';

const CARD_COLORS = [
    { bg: 'linear-gradient(135deg, #f5a623 0%, #fdb94e 100%)', text: '#ffffff' },
    { bg: 'linear-gradient(135deg, #5b8def 0%, #7da8f7 100%)', text: '#ffffff' },
    { bg: 'linear-gradient(135deg, #f06868 0%, #f58a8a 100%)', text: '#ffffff' },
    { bg: 'linear-gradient(135deg, #9b6dd7 0%, #b48ee6 100%)', text: '#ffffff' },
    { bg: 'linear-gradient(135deg, #4db6ac 0%, #72cec4 100%)', text: '#ffffff' },
    { bg: 'linear-gradient(135deg, #e8c832 0%, #f0d85a 100%)', text: '#ffffff' },
];

interface TaskItemProps {
    task: Task;
    index: number;
    onToggle: (id: string) => void;
    onClick: (task: Task) => void;
}

export function TaskItem({ task, index, onToggle, onClick }: TaskItemProps) {
    const hasColor = task.priority !== 'none' || !task.isCompleted;
    const colorIndex = index % CARD_COLORS.length;
    const isColored = hasColor && !task.isCompleted;

    return (
        <div
            className={clsx(
                styles.taskItem,
                task.isCompleted && styles.completed,
                isColored && styles.colored
            )}
            style={isColored ? { background: CARD_COLORS[colorIndex].bg } : undefined}
            onClick={() => onClick(task)}
        >
            <div onClick={(e) => e.stopPropagation()} className={styles.checkWrap}>
                <Checkbox
                    checked={task.isCompleted}
                    onChange={() => onToggle(task.id)}
                    colored={isColored}
                />
            </div>

            <div className={styles.content}>
                <div className={styles.title}>{task.title}</div>
                {(task.dueDate || task.tags.length > 0 || task.subtasks?.length > 0) && (
                    <div className={styles.meta}>
                        {task.dueDate && (
                            <span className={styles.metaItem}>
                                <Calendar size={12} />
                                {task.dueDate}
                            </span>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && (
                            <span className={styles.metaItem}>
                                {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks
                            </span>
                        )}
                        {task.tags.map(tag => (
                            <span key={tag} className={styles.tag}>
                                <Tag size={10} /> {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {task.priority !== 'none' && !task.isCompleted && (
                <span className={clsx(styles.priorityDot, styles[`priority-${task.priority}`])} />
            )}

            <ChevronRight size={16} className={styles.arrow} />
        </div>
    );
}
