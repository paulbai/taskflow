import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';

export const metadata: Metadata = {
    title: 'TaskFlow — Focus & Get Things Done',
    description: 'A beautiful, vibrant task manager with Pomodoro timer and calendar views.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'TaskFlow',
    },
    icons: {
        icon: '/icons/icon.svg',
        apple: '/icons/icon-192.png',
    },
};

export const viewport: Viewport = {
    themeColor: '#4c8c4a',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" data-theme="light" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body>
                <SessionProvider>{children}</SessionProvider>
            </body>
        </html>
    );
}
