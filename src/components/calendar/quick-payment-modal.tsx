/** --- YAML
 * name: QuickPaymentModal
 * description: Fresha-style quick payment modal — numeric keypad for entering payment amount
 * --- */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FONT } from '@/lib/dashboard-theme';

const LIGHT = {
  bg: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  accent: '#6950f3',
  keyBg: '#f5f5f5',
  keyHover: '#ebebeb',
  keyText: '#000000',
  btnBg: '#000000',
  btnText: '#ffffff',
  overlay: 'rgba(0,0,0,0.4)',
  displayBg: '#f9f9f9',
};

const DARK = {
  bg: '#000000',
  border: '#1a1a1a',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  accent: '#8b7cf6',
  keyBg: '#000000',
  keyHover: '#1a1a1a',
  keyText: '#e5e5e5',
  btnBg: '#6950f3',
  btnText: '#ffffff',
  overlay: 'rgba(0,0,0,0.6)',
  displayBg: '#000000',
};

interface QuickPaymentModalProps {
  onClose: () => void;
  theme?: 'light' | 'dark';
  onSubmit?: (amount: number) => void;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export function QuickPaymentModal({ onClose, theme = 'light', onSubmit }: QuickPaymentModalProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [amount, setAmount] = useState('0');

  function handleKey(key: string) {
    if (key === '⌫') {
      setAmount((prev) => prev.length <= 1 ? '0' : prev.slice(0, -1));
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount((prev) => prev + '.');
    } else {
      setAmount((prev) => prev === '0' ? key : prev + key);
    }
  }

  function handleSubmit() {
    const num = parseFloat(amount);
    if (num > 0 && onSubmit) onSubmit(num);
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: C.overlay, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 380,
            backgroundColor: C.bg,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            fontFamily: FONT,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Быстрая оплата</span>
            <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.text }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Amount display */}
          <div style={{ padding: '24px 20px', textAlign: 'center', backgroundColor: C.displayBg }}>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 8 }}>Сумма к оплате</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: C.text, fontFamily: FONT }}>
              {amount} <span style={{ fontSize: 20, color: C.textMuted }}>₴</span>
            </div>
          </div>

          {/* Keypad */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {KEYS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8 }}>
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKey(key)}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: C.keyBg,
                      color: C.keyText,
                      fontSize: key === '⌫' ? 18 : 20,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = C.keyHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = C.keyBg; }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Submit */}
          <div style={{ padding: '0 20px 20px' }}>
            <button
              onClick={handleSubmit}
              disabled={amount === '0'}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 10,
                border: 'none',
                backgroundColor: amount === '0' ? C.keyBg : C.btnBg,
                color: amount === '0' ? C.textMuted : C.btnText,
                fontSize: 16,
                fontWeight: 700,
                cursor: amount === '0' ? 'default' : 'pointer',
                fontFamily: FONT,
                transition: 'all 0.15s',
              }}
            >
              Принять оплату
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
