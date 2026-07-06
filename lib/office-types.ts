// Shared client-side types for the Office OS features

export interface OfficeMember {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
}

export interface OfficeWorkspace {
    id: string;
    name: string;
    type: string;
    description: string | null;
    slug: string;
    iconEmoji: string;
    ownerId: string;
    inviteCode?: string;
    createdAt: string;
    members: OfficeMember[];
    boards: { id: string; name: string }[];
}

export interface PageMeta {
    id: string;
    parentId: string | null;
    title: string;
    iconEmoji: string | null;
    isFavorite: boolean;
    isPrivate: boolean;
    position: number;
    createdById: string;
    updatedAt: string;
}

export interface PageFull extends PageMeta {
    workspaceId: string;
    coverUrl: string | null;
    content: string | null;
    isPublic: boolean;
    isArchived: boolean;
    createdBy: { id: string; name: string };
    comments: PageComment[];
}

export interface PageComment {
    id: string;
    pageId: string;
    parentId: string | null;
    content: string;
    resolved: boolean;
    createdAt: string;
    user: { id: string; name: string; avatar: string | null };
}

export interface DbMeta {
    id: string;
    title: string;
    iconEmoji: string | null;
    defaultView: DbViewType;
    isTaskDb: boolean;
    updatedAt: string;
    rowCount: number;
}

export type DbViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'list';

export type DbColumnType =
    | 'text'
    | 'number'
    | 'select'
    | 'multiSelect'
    | 'date'
    | 'person'
    | 'checkbox'
    | 'url'
    | 'formula'
    | 'files';

/** An attachment on a `files` column: an uploaded document or a pasted link. */
export interface DbAttachment {
    id: string;
    name: string;
    url: string;
    kind: 'file' | 'link';
}

export interface DbSelectOption {
    id: string;
    label: string;
    color: string; // one of the design-system card colors
}

export interface DbColumn {
    id: string;
    name: string;
    type: DbColumnType;
    options?: DbSelectOption[]; // for select / multiSelect
    numberFormat?: 'integer' | 'decimal' | 'currency';
    formula?: string; // for formula columns
}

export interface DbRow {
    id: string;
    data: Record<string, unknown>;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface DbFull {
    id: string;
    workspaceId: string;
    title: string;
    iconEmoji: string | null;
    schema: DbColumn[];
    defaultView: DbViewType;
    isTaskDb: boolean;
}

// ── Block editor types ──────────────────────────────────────────

export type BlockType =
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'numberedList'
    | 'todo'
    | 'toggle'
    | 'quote'
    | 'callout'
    | 'code'
    | 'divider'
    | 'image'
    | 'embed';

export interface Block {
    id: string;
    type: BlockType;
    content: string; // HTML string for rich inline formatting
    props: {
        checked?: boolean; // todo
        collapsed?: boolean; // toggle
        emoji?: string; // callout
        color?: string; // callout bg
        url?: string; // image / embed
        language?: string; // code
        indent?: number; // nesting level
    };
}

export interface OfficeNotification {
    id: string;
    type: string;
    message: string;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: string;
}
