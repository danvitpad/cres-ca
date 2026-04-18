/** --- YAML
 * name: Auth Layout (passthrough)
 * description: Full-screen passthrough layout for auth routes. Page owns its own chrome (header/split layout/theme). No wrapper, no max-width, no duplicate header.
 * created: 2026-04-15
 * updated: 2026-04-18
 * --- */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
