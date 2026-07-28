'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { signUp, type AuthState } from '../actions';

export default function SignUpPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <Field label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 8 characters." required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          {state?.error ? <Callout tone="danger">{state.error}</Callout> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have one?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
