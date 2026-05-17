/** --- YAML
 * name: MiniAppProfileEditPage
 * description: Stub — заполнится мокапом mobile-client/profile-edit на следующем шаге.
 * created: 2026-05-17
 * --- */

'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobilePage } from '@/components/miniapp/shells';
import '@/styles/od-client-mini-app.css';

export default function MiniAppProfileEditPage() {
  const router = useRouter();
  return (
    <MobilePage className="od-client-mini-app">
      <div className="mc-top">
        <button
          onClick={() => router.back()}
          className="mc-icbtn"
          aria-label="Назад"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="mc-top-title" style={{ flex: 1, textAlign: 'center' }}>
          Редагувати
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="mc-empty" style={{ minHeight: '60dvh' }}>
        <p className="mc-empty-t">Скоро</p>
        <span className="mc-empty-s">Редагування профілю буде доступне найближчим часом.</span>
      </div>
    </MobilePage>
  );
}
