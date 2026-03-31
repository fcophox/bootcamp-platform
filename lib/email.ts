import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    let lastError: Error | unknown = null;

    // 1. Try SMTP if configured and not placeholder
    const isPlaceholder = smtpUser === 'tu-correo@gmail.com' || smtpPass === 'tu-app-password';
    
    if (smtpHost && smtpUser && smtpPass && !isPlaceholder) {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        try {
            const info = await transporter.sendMail({
                from: smtpFrom || smtpUser,
                to,
                subject,
                html,
            });
            console.log('Email sent via SMTP:', info.messageId);
            return { data: info, error: null };
        } catch (error: unknown) {
            console.error('SMTP Error:', error);
            lastError = error;
            // Don't return yet, try Resend as fallback
        }
    }

    // 2. Fallback to Resend if API Key is present
    if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        try {
            const { data, error } = await resend.emails.send({
                from: `Plataforma Educativa <${resendFrom}>`,
                to: [to],
                subject,
                html,
            });

            if (error) {
                console.error('Resend API Error:', error);
                lastError = error;
            } else {
                console.log('Email sent via Resend:', data?.id);
                return { data, error: null };
            }
        } catch (error: unknown) {
            console.error('Resend Exception:', error);
            lastError = error;
        }
    }

    return { 
        data: null, 
        error: lastError || new Error('No email service (SMTP or Resend) is configured or all failed') 
    };
}
