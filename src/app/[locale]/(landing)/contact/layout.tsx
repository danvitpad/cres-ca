/** --- YAML
 * name: Contact Layout
 * description: Metadata wrapper for contact page — provides unique SEO tags
 * --- */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact & Support',
  description: 'Get in touch with CRES-CA support — email, Telegram, or contact form. We are here to help with questions, feedback, and partnerships.',
  openGraph: {
    title: 'Contact CRES-CA Support',
    description: 'Reach out via email, Telegram, or our contact form. We respond within 24 hours.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
