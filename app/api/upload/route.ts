import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientId } from '@/lib/rate-limit';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const UPLOAD_NOT_CONFIGURED =
    'File uploads are not set up yet. Attach a link instead, or add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) to enable uploads.';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = getClientId(req);
        const { success: allowed } = await rateLimit(`upload:${clientId}`, { maxRequests: 20, windowMs: 60_000 });
        if (!allowed) {
            return NextResponse.json({ error: 'Too many uploads. Please slow down.' }, { status: 429 });
        }

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json({ error: UPLOAD_NOT_CONFIGURED }, { status: 503 });
        }

        const formData = await req.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'A file is required' }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ error: 'File is too large (max 10 MB)' }, { status: 400 });
        }

        const safeName = file.name.replace(/[^\w.\- ]/g, '_').slice(0, 120) || 'file';
        const key = `deliverables/${crypto.randomBytes(8).toString('hex')}-${safeName}`;

        const blob = await put(key, file, { access: 'public' });

        return NextResponse.json({ name: file.name, url: blob.url }, { status: 201 });
    } catch (error) {
        console.error('POST /api/upload error:', error);
        return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }
}
