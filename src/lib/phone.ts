/** --- YAML
 * name: Phone formatter
 * description: Display-only formatter for Ukrainian & international phone numbers
 * --- */

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  // Normalize UA variants:
  //   380931234567  → +380 93 123 45 67
  //   0931234567    → +380 93 123 45 67
  //   931234567     → +380 93 123 45 67
  let d = digits;
  if (d.length === 12 && d.startsWith('380')) d = '+' + d;
  else if (d.length === 10 && d.startsWith('0')) d = '+380' + d.slice(1);
  else if (d.length === 9) d = '+380' + d;
  else d = raw.startsWith('+') ? raw : '+' + digits;

  const m = d.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;

  // Generic international fallback: +CC AAA BBB CC DD (loose chunking)
  if (d.startsWith('+') && digits.length >= 10) {
    return d;
  }
  return raw;
}
