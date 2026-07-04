"use client";

import dynamic from 'next/dynamic';

// Database views are heavy, purely client-side components
const DatabaseRoute = dynamic(
    () => import('@/components/database/DatabaseRoute').then(m => m.DatabaseRoute),
    { ssr: false }
);

export default function DatabaseViewPage() {
    return <DatabaseRoute />;
}
