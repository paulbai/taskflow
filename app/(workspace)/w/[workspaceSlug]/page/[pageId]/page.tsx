"use client";

import dynamic from 'next/dynamic';

// The block editor is a heavy, purely client-side component
const PageEditorRoute = dynamic(
    () => import('@/components/editor/PageEditorRoute').then(m => m.PageEditorRoute),
    { ssr: false }
);

export default function PageEditorPage() {
    return <PageEditorRoute />;
}
