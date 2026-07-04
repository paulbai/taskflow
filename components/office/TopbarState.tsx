"use client";

import React, { createContext, useContext, useState, useMemo } from 'react';

export interface Crumb {
    label: string;
    emoji?: string | null;
    href?: string;
}

interface TopbarState {
    crumbs: Crumb[];
    saveStatus: '' | 'saving' | 'saved';
    commentCount: number;
    commentsOpen: boolean;
    presence: { userId: string; name: string }[];
}

interface TopbarStateContextType extends TopbarState {
    setCrumbs: (crumbs: Crumb[]) => void;
    setSaveStatus: (status: '' | 'saving' | 'saved') => void;
    setCommentCount: (count: number) => void;
    setCommentsOpen: (open: boolean) => void;
    setPresence: (presence: { userId: string; name: string }[]) => void;
}

const TopbarStateContext = createContext<TopbarStateContextType>({
    crumbs: [],
    saveStatus: '',
    commentCount: 0,
    commentsOpen: false,
    presence: [],
    setCrumbs: () => {},
    setSaveStatus: () => {},
    setCommentCount: () => {},
    setCommentsOpen: () => {},
    setPresence: () => {},
});

export const useTopbar = () => useContext(TopbarStateContext);

export function TopbarStateProvider({ children }: { children: React.ReactNode }) {
    const [crumbs, setCrumbs] = useState<Crumb[]>([]);
    const [saveStatus, setSaveStatus] = useState<'' | 'saving' | 'saved'>('');
    const [commentCount, setCommentCount] = useState(0);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [presence, setPresence] = useState<{ userId: string; name: string }[]>([]);

    const value = useMemo(() => ({
        crumbs, saveStatus, commentCount, commentsOpen, presence,
        setCrumbs, setSaveStatus, setCommentCount, setCommentsOpen, setPresence,
    }), [crumbs, saveStatus, commentCount, commentsOpen, presence]);

    return (
        <TopbarStateContext.Provider value={value}>
            {children}
        </TopbarStateContext.Provider>
    );
}
