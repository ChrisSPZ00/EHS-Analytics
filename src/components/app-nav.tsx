'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/incidents', label: 'Incident Log' },
  { href: '/corrective-actions', label: 'Corrective Actions' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/compliance', label: 'Compliance' },
];

export function AppNav({
  orgName,
  userLabel,
  role,
  signOutAction,
}: {
  orgName: string;
  userLabel: string;
  role: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
          <p className="text-xs text-muted-foreground">SafePulse Analytics</p>
        </div>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm leading-tight">{userLabel}</p>
            <p className="text-xs capitalize text-muted-foreground">{role}</p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
