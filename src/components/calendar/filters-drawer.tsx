/** --- YAML
 * name: FiltersDrawer
 * description: Fresha-style visibility filters drawer — 7 expandable filter sections with footer actions
 * --- */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type FiltersDrawerProps = {
  theme: 'light' | 'dark';
  onApply?: () => void;
  onClear?: () => void;
};

const LIGHT = {
  text: '#0d0d0d',
  textMuted: '#737373',
  border: '#e5e5e5',
  sectionBg: '#f9f9f9',
  accent: '#6950f3',
  btnBg: '#0d0d0d',
  btnText: '#ffffff',
  btnOutlineBg: 'transparent',
  btnOutlineBorder: '#e5e5e5',
  checkboxBorder: '#d4d4d4',
};

const DARK = {
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  border: '#2a2a2a',
  sectionBg: '#252525',
  accent: '#8b7cf6',
  btnBg: '#6950f3',
  btnText: '#ffffff',
  btnOutlineBg: 'transparent',
  btnOutlineBorder: '#3a3a3a',
  checkboxBorder: '#4a4a4a',
};

type FilterSection = {
  key: string;
  label: string;
  options: string[];
};

const SECTIONS: FilterSection[] = [
  { key: 'status', label: 'Статус записи', options: ['Забронировано', 'Подтверждено', 'Клиент прибыл', 'Начато', 'Неявка', 'Отмена'] },
  { key: 'type', label: 'Тип', options: ['Запись', 'Групповая запись', 'Заблокированное время'] },
  { key: 'channel', label: 'Канал', options: ['Онлайн', 'В салоне', 'По телефону', 'Другое'] },
  { key: 'payment', label: 'Статус оплаты', options: ['Не оплачено', 'Частично оплачено', 'Оплачено', 'Возврат'] },
  { key: 'services', label: 'Услуги', options: [] },
  { key: 'created', label: 'Дата создания записи', options: ['Сегодня', 'Вчера', 'Последние 7 дней', 'Последние 30 дней'] },
  { key: 'team', label: 'Запрошенный участник команды', options: [] },
];

export function FiltersDrawerContent({ theme, onApply, onClear }: FiltersDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  function toggleSection(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  function toggleOption(sectionKey: string, option: string) {
    const current = selected[sectionKey] || new Set<string>();
    const next = new Set(current);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    setSelected({ ...selected, [sectionKey]: next });
  }

  const totalSelected = Object.values(selected).reduce((sum, set) => sum + set.size, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Saved filters dropdown */}
      <div style={{ padding: '12px 16px', borderBottom: `0.8px solid ${C.border}` }}>
        <button
          type="button"
          style={{
            width: '100%',
            height: 36,
            borderRadius: 999,
            border: `0.8px solid ${C.btnOutlineBorder}`,
            backgroundColor: C.btnOutlineBg,
            color: C.text,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
          }}
        >
          <span>Сохраненные фильтры</span>
          <ChevronDown style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Filter sections */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {SECTIONS.map((section) => {
          const isExpanded = expanded.has(section.key);
          const sectionSelected = selected[section.key] || new Set<string>();

          return (
            <div key={section.key} style={{ borderBottom: `0.8px solid ${C.border}` }}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {section.label}
                  {sectionSelected.size > 0 && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: C.accent,
                      color: '#ffffff',
                      borderRadius: 999,
                      padding: '1px 7px',
                      minWidth: 18,
                      textAlign: 'center',
                    }}>
                      {sectionSelected.size}
                    </span>
                  )}
                </span>
                {isExpanded
                  ? <ChevronDown style={{ width: 16, height: 16, color: C.textMuted }} />
                  : <ChevronRight style={{ width: 16, height: 16, color: C.textMuted }} />
                }
              </button>

              {isExpanded && section.options.length > 0 && (
                <div style={{ padding: '0 16px 12px' }}>
                  {section.options.map((option) => {
                    const isChecked = sectionSelected.has(option);
                    return (
                      <label
                        key={option}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 0',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: C.text,
                        }}
                      >
                        <div
                          onClick={() => toggleOption(section.key, option)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: `1.5px solid ${isChecked ? C.accent : C.checkboxBorder}`,
                            backgroundColor: isChecked ? C.accent : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 150ms',
                            flexShrink: 0,
                          }}
                        >
                          {isChecked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}

              {isExpanded && section.options.length === 0 && (
                <div style={{ padding: '0 16px 12px', fontSize: 13, color: C.textMuted }}>
                  Нет доступных фильтров
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: `0.8px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => {
            setSelected({});
            onClear?.();
          }}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: `0.8px solid ${C.btnOutlineBorder}`,
            backgroundColor: C.btnOutlineBg,
            color: C.text,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Очистить
        </button>
        <button
          type="button"
          onClick={onApply}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: 'none',
            backgroundColor: C.btnBg,
            color: C.btnText,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Применить{totalSelected > 0 ? ` (${totalSelected})` : ''}
        </button>
      </div>
    </div>
  );
}
