"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { DatabaseView } from './DatabaseView';

export function DatabaseRoute() {
    const params = useParams<{ workspaceSlug: string; databaseId: string }>();
    const databaseId = params?.databaseId;

    if (!databaseId) return null;

    return <DatabaseView key={databaseId} databaseId={databaseId} />;
}
