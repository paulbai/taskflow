import { Resend } from 'resend';

/**
 * Email sending via Resend. Gracefully degrades when RESEND_API_KEY
 * is not configured (returns false so callers can adapt messaging).
 */

const FROM = process.env.EMAIL_FROM || 'TaskFlow <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) return false;

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: FROM,
            to,
            subject: 'Reset your TaskFlow password',
            html: `
                <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #1a2e1a;">Reset your password</h2>
                    <p style="color: #5a7a5a; line-height: 1.6;">
                        Someone requested a password reset for your TaskFlow account.
                        If this was you, click the button below. The link expires in 1 hour.
                    </p>
                    <a href="${resetUrl}"
                       style="display: inline-block; margin: 16px 0; padding: 12px 28px;
                              background: #4c8c4a; color: #ffffff; text-decoration: none;
                              border-radius: 12px; font-weight: 700;">
                        Reset password
                    </a>
                    <p style="color: #8da88d; font-size: 13px; line-height: 1.6;">
                        If you didn't request this, you can safely ignore this email —
                        your password will stay unchanged.
                    </p>
                </div>
            `,
        });
        if (error) {
            console.error('Resend error:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('sendPasswordResetEmail failed:', err);
        return false;
    }
}
