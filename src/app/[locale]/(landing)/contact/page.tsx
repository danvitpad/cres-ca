/** --- YAML
 * name: ContactPage
 * description: Public contact/support page with form, Telegram link, and email
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Send, MessageCircle, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const subjects = ['subjectBug', 'subjectFeature', 'subjectBilling', 'subjectPartnership', 'subjectOther'] as const;

export default function ContactPage() {
  const t = useTranslations('contact');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name') as string,
      email: form.get('email') as string,
      subject: form.get('subject') as string,
      message: form.get('message') as string,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(t('success'));
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error(t('error'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-[var(--space-page)] py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        CRES-CA
      </Link>

      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">{t('name')}</label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">{t('email')}</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">{t('subject')}</label>
          <select
            id="subject"
            name="subject"
            required
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          >
            {subjects.map((key) => (
              <option key={key} value={key}>{t(key)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium">{t('message')}</label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {t('send')}
        </button>
      </form>

      {/* Alternative contact */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <a
          href="https://t.me/CresCASupport"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border p-4 transition-colors hover:bg-muted"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('telegramSupport')}</p>
            <p className="text-xs text-muted-foreground">@CresCASupport</p>
          </div>
        </a>
        <a
          href="mailto:support@cres-ca.com"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border p-4 transition-colors hover:bg-muted"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('emailSupport')}</p>
            <p className="text-xs text-muted-foreground">support@cres-ca.com</p>
          </div>
        </a>
      </div>
    </div>
  );
}
