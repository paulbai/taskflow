"use client";

import React from 'react';
import {
    Calendar,
    CheckSquare,
    Hash,
    Link2,
    List,
    Sigma,
    Tags,
    Type,
    User,
} from 'lucide-react';
import type { DbColumnType } from '@/lib/office-types';

const ICONS: Record<DbColumnType, React.ComponentType<{ size?: number | string }>> = {
    text: Type,
    number: Hash,
    select: List,
    multiSelect: Tags,
    date: Calendar,
    person: User,
    checkbox: CheckSquare,
    url: Link2,
    formula: Sigma,
};

export const COLUMN_TYPE_LABELS: Record<DbColumnType, string> = {
    text: 'Text',
    number: 'Number',
    select: 'Select',
    multiSelect: 'Multi-select',
    date: 'Date',
    person: 'Person',
    checkbox: 'Checkbox',
    url: 'URL',
    formula: 'Formula',
};

export function ColumnTypeIcon({ type, size = 14 }: { type: DbColumnType; size?: number }) {
    const Icon = ICONS[type] || Type;
    return <Icon size={size} />;
}
