/** --- YAML
 * name: Resend Email Client
 * description: Send transactional emails via Resend from noreply@cres-ca.com
 * --- */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'CRES-CA <noreply@cres-ca.com>';

export async function sendOTPEmail(to: string, otp: string, locale: string = 'uk') {
  const subjects: Record<string, string> = {
    uk: 'Ваш код підтвердження — CRES-CA',
    ru: 'Ваш код подтверждения — CRES-CA',
    en: 'Your verification code — CRES-CA',
  };

  const bodies: Record<string, string> = {
    uk: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">CRES-CA</h1>
          <p style="color: #64748b; margin-top: 8px;">Ваш сервіс для управління бізнесом</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
          <p style="color: #334155; margin: 0 0 16px;">Ваш код підтвердження:</p>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding: 16px; background: white; border-radius: 8px; display: inline-block;">${otp}</div>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 16px;">Код дійсний 10 хвилин</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">Якщо ви не запитували цей код, проігноруйте цей лист.</p>
      </div>
    `,
    ru: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">CRES-CA</h1>
          <p style="color: #64748b; margin-top: 8px;">Ваш сервис для управления бизнесом</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
          <p style="color: #334155; margin: 0 0 16px;">Ваш код подтверждения:</p>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding: 16px; background: white; border-radius: 8px; display: inline-block;">${otp}</div>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 16px;">Код действителен 10 минут</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
      </div>
    `,
    en: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">CRES-CA</h1>
          <p style="color: #64748b; margin-top: 8px;">Your business management service</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
          <p style="color: #334155; margin: 0 0 16px;">Your verification code:</p>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding: 16px; background: white; border-radius: 8px; display: inline-block;">${otp}</div>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 16px;">Code valid for 10 minutes</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: subjects[locale] ?? subjects.en,
    html: bodies[locale] ?? bodies.en,
  });

  if (error) throw new Error(error.message);
}

export async function sendPasswordResetEmail(to: string, otp: string, locale: string = 'uk') {
  const subjects: Record<string, string> = {
    uk: 'Скидання пароля — CRES-CA',
    ru: 'Сброс пароля — CRES-CA',
    en: 'Password reset — CRES-CA',
  };

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: subjects[locale] ?? subjects.en,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">CRES-CA</h1>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
          <p style="color: #334155; margin: 0 0 16px;">${locale === 'uk' ? 'Код для скидання пароля:' : locale === 'ru' ? 'Код для сброса пароля:' : 'Your password reset code:'}</p>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding: 16px; background: white; border-radius: 8px; display: inline-block;">${otp}</div>
        </div>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

export { resend };
