import { withAuth } from 'next-auth/middleware';

export default withAuth({
    pages: {
        signIn: '/signin',
    },
});

export const config = {
    matcher: [
        // Protect all app routes except auth pages and API
        '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*|signin|signup).*)',
    ],
};
