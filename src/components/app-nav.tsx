'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/incidents', label: 'Incident Log' },
  { href: '/corrective-actions', label: 'Corrective Actions' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/compliance', label: 'Compliance' },
];

/**
 * The header carries the brand navy with white ink (10.36:1) and a California Gold
 * rule beneath it. The gold is a rule and never a label here — at 1.78:1 on white it
 * cannot carry text, so it does structural work instead.
 */
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
    <header className="app-chrome bg-brand-primary">
      <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo tone="onPrimary" />
          <span className="hidden h-8 w-px bg-white/20 sm:block" />
          <p className="hidden min-w-0 truncate text-sm text-on-primary-muted sm:block">
            {orgName}
          </p>
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
                  active
                    ? 'bg-white/15 text-on-primary'
                    : 'text-on-primary-muted hover:bg-white/10 hover:text-on-primary',
                )}
              >
                {link.label}
                {/* Gold underline marks the active tab; the background tint carries it
                    too, so the colour is never the only signal. */}
                {active ? (
                  <span aria-hidden className="mt-1 block h-0.5 rounded-full bg-brand-gold" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm leading-tight text-on-primary">{userLabel}</p>
            <p className="text-xs capitalize text-on-primary-muted">{role}</p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              size="sm"
              className="border border-white/30 bg-transparent text-on-primary hover:bg-white/10"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
      <div aria-hidden className="h-1 bg-brand-gold" />
    </header>
  );
}
