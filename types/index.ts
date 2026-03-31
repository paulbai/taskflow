export type Priority = 'none' | 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    createdAt: number;
    priority: Priority;
    startDate?: string;
    dueDate?: string;
    tags: string[];
    subtasks: Subtask[];
    description?: string;
    assigneeId?: string;
    assignee?: { id: string; name: string };
    createdBy?: { id: string; name: string };
    inviteCode?: string;
    listId?: string;
    boardId?: string;
}

export interface Subtask {
    id: string;
    title: string;
    isCompleted: boolean;
}

export interface Workspace {
    id: string;
    name: string;
    type: 'company' | 'family' | 'team' | 'other';
    description?: string;
    ownerId: string;
    inviteCode?: string;
    members: WorkspaceMember[];
    boards: Board[];
    createdAt: string;
}

export interface WorkspaceMember {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
    avatar?: string;
}

export interface Board {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    inviteCode?: string;
    taskCount?: number;
    createdAt: string;
}

export interface List {
    id: string;
    name: string;
    icon?: string;
    ownerId: string;
    members: string[];
}

export interface User {
    id: string;
    name: string;
    avatar?: string;
}
