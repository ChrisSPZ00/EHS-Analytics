import { Logo } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo layout="stacked" />
        <p className="text-sm text-muted-foreground">EHS analytics that shows its working.</p>
      </div>
      {children}
      <div aria-hidden className="h-1 w-24 rounded-full bg-brand-gold" />
    </div>
  );
}
