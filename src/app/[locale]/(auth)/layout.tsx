/** --- YAML
 * name: Auth Layout
 * description: Centered card layout for login/register pages — no sidebar, no bottom nav
 * --- */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">CRES-CA</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
