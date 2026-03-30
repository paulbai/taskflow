"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface ListData {
    id: string;
    name: string;
    icon: string;
    ownerId: string;
    isShared: boolean;
    memberCount: number;
    taskCount: number;
    inviteCode?: string;
    members: { id: string; name: string; email: string; role: string }[];
}

interface AppContextType {
    lists: ListData[];
    activeListId: string;
    activeList: ListData | null;
    setActiveListId: (id: string) => void;
    refreshLists: () => Promise<void>;
    activeTab: 'home' | 'calendar' | 'timer' | 'settings';
    setActiveTab: (tab: 'home' | 'calendar' | 'timer' | 'settings') => void;
}

const AppContext = createContext<AppContextType>({
    lists: [],
    activeListId: '',
    activeList: null,
    setActiveListId: () => {},
    refreshLists: async () => {},
    activeTab: 'home',
    setActiveTab: () => {},
});

export const useAppContext = () => useContext(AppContext);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [lists, setLists] = useState<ListData[]>([]);
    const [activeListId, setActiveListId] = useState('');
    const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'timer' | 'settings'>('home');

    const refreshLists = useCallback(async () => {
        if (!session?.user) return;
        const res = await fetch('/api/lists');
        if (res.ok) {
            const data: ListData[] = await res.json();
            setLists(data);
            if (!activeListId || !data.find(l => l.id === activeListId)) {
                if (data.length > 0) setActiveListId(data[0].id);
            }
        }
    }, [session, activeListId]);

    useEffect(() => {
        refreshLists();
    }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeList = lists.find(l => l.id === activeListId) || null;

    return (
        <AppContext.Provider value={{ lists, activeListId, activeList, setActiveListId, refreshLists, activeTab, setActiveTab }}>
            {children}
        </AppContext.Provider>
    );
}
