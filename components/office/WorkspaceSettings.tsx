"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Trash2, UserPlus } from 'lucide-react';
import styles from './WorkspaceSettings.module.css';
import { useOffice } from './OfficeContext';
import { useTopbar } from './TopbarState';

type Tab = 'general' | 'members' | 'danger';

export function WorkspaceSettings() {
    const router = useRouter();
    const { workspace, currentUserId, refreshWorkspaces } = useOffice();
    const { setCrumbs, setCommentCount } = useTopbar();

    const [tab, setTab] = useState<Tab>('general');
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [icon, setIcon] = useState('');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [confirmName, setConfirmName] = useState('');

    const myRole = workspace?.members.find(m => m.userId === currentUserId)?.role;
    const canManage = myRole === 'owner' || myRole === 'admin';
    const isOwner = workspace?.ownerId === currentUserId;

    useEffect(() => {
        setCrumbs([{ label: 'Settings' }]);
        setCommentCount(0);
    }, [setCrumbs, setCommentCount]);

    useEffect(() => {
        if (workspace) {
            setName(workspace.name);
            setSlug(workspace.slug);
            setIcon(workspace.iconEmoji);
        }
    }, [workspace]);

    const saveGeneral = useCallback(async () => {
        if (!workspace) return;
        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slug, iconEmoji: icon }),
            });
            const data = await res.json();
            if (!res.ok) {
                setFeedback({ ok: false, text: data.error || 'Save failed' });
                return;
            }
            setFeedback({ ok: true, text: 'Saved!' });
            await refreshWorkspaces();
            if (data.slug && data.slug !== workspace.slug) {
                router.replace(`/w/${data.slug}/settings`);
            }
        } finally {
            setSaving(false);
        }
    }, [workspace, name, slug, icon, refreshWorkspaces, router]);

    const invite = useCallback(async () => {
        if (!workspace || !inviteEmail.trim()) return;
        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail.trim() }),
            });
            const data = await res.json();
            setFeedback({ ok: res.ok, text: data.message || data.error || 'Done' });
            if (res.ok) {
                setInviteEmail('');
                await refreshWorkspaces();
            }
        } finally {
            setSaving(false);
        }
    }, [workspace, inviteEmail, refreshWorkspaces]);

    const changeRole = useCallback(async (memberId: string, role: string) => {
        if (!workspace) return;
        await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });
        await refreshWorkspaces();
    }, [workspace, refreshWorkspaces]);

    const removeMember = useCallback(async (memberId: string) => {
        if (!workspace) return;
        await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: 'DELETE' });
        await refreshWorkspaces();
    }, [workspace, refreshWorkspaces]);

    const deleteWorkspace = useCallback(async () => {
        if (!workspace || confirmName !== workspace.name) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmName }),
            });
            if (res.ok) {
                await refreshWorkspaces();
                router.push('/');
            } else {
                const data = await res.json();
                setFeedback({ ok: false, text: data.error || 'Delete failed' });
            }
        } finally {
            setSaving(false);
        }
    }, [workspace, confirmName, refreshWorkspaces, router]);

    if (!workspace) return null;

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Workspace settings</h1>

            <div className={styles.tabs}>
                <button className={clsx(styles.tab, tab === 'general' && styles.active)} onClick={() => setTab('general')}>
                    General
                </button>
                <button className={clsx(styles.tab, tab === 'members' && styles.active)} onClick={() => setTab('members')}>
                    Members ({workspace.members.length})
                </button>
                {isOwner && (
                    <button className={clsx(styles.tab, tab === 'danger' && styles.active)} onClick={() => setTab('danger')}>
                        Danger zone
                    </button>
                )}
            </div>

            {feedback && (
                <div className={clsx(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)} style={{ marginBottom: 16 }}>
                    {feedback.text}
                </div>
            )}

            {tab === 'general' && (
                <div className={styles.section}>
                    <div className={styles.field}>
                        <label className={styles.label}>Icon</label>
                        <input
                            className={styles.input}
                            style={{ width: 80, textAlign: 'center', fontSize: 22 }}
                            value={icon}
                            onChange={e => setIcon(e.target.value)}
                            maxLength={4}
                            disabled={!canManage}
                        />
                        <span className={styles.hint}>Any emoji</span>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Workspace name</label>
                        <input
                            className={styles.input}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={100}
                            disabled={!canManage}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>URL slug</label>
                        <input
                            className={styles.input}
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            maxLength={48}
                            disabled={!canManage}
                        />
                        <span className={styles.hint}>taskflow.app/w/{slug || '…'}</span>
                    </div>
                    {canManage && (
                        <button className={styles.saveBtn} onClick={saveGeneral} disabled={saving || !name.trim()}>
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    )}
                </div>
            )}

            {tab === 'members' && (
                <div className={styles.section}>
                    {canManage && (
                        <div className={styles.field}>
                            <label className={styles.label}>Invite by email</label>
                            <div className={styles.inviteRow}>
                                <input
                                    className={styles.input}
                                    type="email"
                                    placeholder="teammate@company.com"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') invite(); }}
                                />
                                <button className={styles.saveBtn} onClick={invite} disabled={saving || !inviteEmail.trim()}>
                                    <UserPlus size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                                    Invite
                                </button>
                            </div>
                            <span className={styles.hint}>
                                Or share the invite code: <strong>{workspace.inviteCode || '—'}</strong>
                            </span>
                        </div>
                    )}

                    <div className={styles.memberTable}>
                        {workspace.members.map(member => (
                            <div key={member.id} className={styles.memberRow}>
                                <span className={styles.avatar}>{member.name.charAt(0).toUpperCase()}</span>
                                <div className={styles.memberInfo}>
                                    <div className={styles.memberName}>
                                        {member.name} {member.userId === currentUserId && '(you)'}
                                    </div>
                                    <div className={styles.memberEmail}>{member.email}</div>
                                </div>
                                {member.role === 'owner' || !canManage ? (
                                    <span className={styles.roleBadge}>{member.role}</span>
                                ) : (
                                    <select
                                        className={styles.roleSelect}
                                        value={member.role}
                                        onChange={e => changeRole(member.id, e.target.value)}
                                    >
                                        <option value="admin">admin</option>
                                        <option value="member">member</option>
                                        <option value="viewer">viewer</option>
                                    </select>
                                )}
                                <button
                                    className={styles.removeBtn}
                                    onClick={() => removeMember(member.id)}
                                    disabled={member.userId === currentUserId || member.role === 'owner' || !canManage}
                                    aria-label={`Remove ${member.name}`}
                                    title={member.userId === currentUserId ? "You can't remove yourself here" : 'Remove member'}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'danger' && isOwner && (
                <div className={styles.section}>
                    <div className={styles.dangerBox}>
                        <span className={styles.dangerTitle}>Delete this workspace</span>
                        <span className={styles.dangerText}>
                            This permanently deletes <strong>{workspace.name}</strong>, including all its pages,
                            databases, and boards. This cannot be undone. Type the workspace name to confirm.
                        </span>
                        <input
                            className={styles.input}
                            placeholder={workspace.name}
                            value={confirmName}
                            onChange={e => setConfirmName(e.target.value)}
                        />
                        <button
                            className={styles.dangerBtn}
                            onClick={deleteWorkspace}
                            disabled={saving || confirmName !== workspace.name}
                        >
                            Delete workspace forever
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
