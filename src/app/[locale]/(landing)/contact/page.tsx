/** --- YAML
 * name: ContactPage
 * description: Public contact/support page — мигрирована на классы рецептов из STYLE.md (input/textarea/select/btn-primary/heading-page/contact-card)
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
    <div className="landing-v6">
      <div className="landing-container" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 48 }}>
        <Link href="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, paddingLeft: 0 }}>
          <ArrowLeft className="h-4 w-4" />
          CRES-CA
        </Link>

        <h1 className="heading-page">{t('title')}</h1>
        <p className="text-muted" style={{ marginTop: 8 }}>{t('subtitle')}</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label htmlFor="name" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{t('name')}</label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{t('email')}</label>
              <input id="email" name="email" type="email" required className="input" />
            </div>
          </div>

          <div>
            <label htmlFor="subject" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{t('subject')}</label>
            <select id="subject" name="subject" required className="select">
              {subjects.map((key) => <option key={key} value={key}>{t(key)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="message" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{t('message')}</label>
            <textarea id="message" name="message" required rows={5} className="textarea" />
          </div>

          <button type="submit" disabled={sending} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
            <Send className="h-4 w-4" />
            {t('send')}
          </button>
        </form>

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <a href="https://t.me/CresCASupport" target="_blank" rel="noopener noreferrer" className="contact-card">
            <div className="contact-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="contact-title">{t('telegramSupport')}</p>
              <p className="contact-meta">@CresCASupport</p>
            </div>
          </a>
          <a href="mailto:support@cres-ca.com" className="contact-card">
            <div className="contact-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="contact-title">{t('emailSupport')}</p>
              <p className="contact-meta">support@cres-ca.com</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
