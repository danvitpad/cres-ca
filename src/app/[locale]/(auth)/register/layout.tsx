/** --- YAML
 * name: Register Layout
 * description: Metadata wrapper for register page
 * --- */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up Free',
  description: 'Create your CRES-CA account — start managing bookings, clients, and finances in minutes. Free 14-day trial, no credit card required.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
