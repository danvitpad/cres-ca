/** --- YAML
 * name: Auth Layout
 * description: Centered card layout for login/register with ambient glow background
 * --- */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10 bg-muted/30">
        <div className="absolute left-1/3 top-1/4 h-[350px] w-[350px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/3 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-[100px]" />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">CRES-CA</h1>
          <p className="text-sm text-muted-foreground mt-1">Your business management platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
