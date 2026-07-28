'use client';

import { use } from 'react';
import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { signIn, type AuthState } from '../actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to SafePulse</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? '/incidents'} />
          <Field label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {state?.error ? <Callout tone="danger">{state.error}</Callout> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
