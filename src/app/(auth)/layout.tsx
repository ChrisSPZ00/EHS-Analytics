export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight">SafePulse Analytics</p>
        <p className="text-sm text-muted-foreground">EHS analytics that shows its working.</p>
      </div>
      {children}
    </div>
  );
}
