export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Task {
    id: string;
    title: string;
    isCompleted: boolean;
    createdAt: number;
    priority: Priority;
    dueDate?: string; // ISO Date string YYYY-MM-DD
    tags: string[];
    subtasks: Subtask[];
    description?: string;
    assigneeId?: string;
    inviteCode?: string;
}

export interface Subtask {
    id: string;
    title: string;
    isCompleted: boolean;
}

export interface List {
    id: string;
    name: string;
    icon?: string;
    ownerId: string;
    members: string[]; // User IDs
}

export interface User {
    id: string;
    name: string;
    avatar?: string;
}
