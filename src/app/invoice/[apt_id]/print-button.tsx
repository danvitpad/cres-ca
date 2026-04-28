'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: '10px 20px',
        background: '#0d9488',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      Сохранить как PDF
    </button>
  );
}
