/** --- YAML
 * name: LegalPage
 * description: Общий шаблон юридических страниц лендинга (terms / privacy / cookies). Использует
 *              классы рецептов лендинга из STYLE.md (Часть 2.Б).
 * created: 2026-04-29
 * --- */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export type LegalSection = { title: string; body: string };

export function LegalPage({
  title, lastUpdated, sections,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="landing-v6">
      <div className="landing-container" style={{ maxWidth: 800, paddingTop: 48, paddingBottom: 48 }}>
        <Link href="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, paddingLeft: 0 }}>
          <ArrowLeft className="h-4 w-4" />
          CRES-CA
        </Link>

        <h1 className="heading-page">{title}</h1>
        <p className="text-muted" style={{ marginTop: 8 }}>{lastUpdated}</p>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="heading-card" style={{ marginBottom: 8 }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--lfg2)', lineHeight: 1.65, margin: 0 }}>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
