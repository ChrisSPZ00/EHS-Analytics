'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { createOrganization, type AuthState } from '../(auth)/actions';

export default function OnboardingPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(createOrganization, null);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up your organization</CardTitle>
          <CardDescription>
            This creates your workspace and makes you its owner. Everything you enter from here
            on is visible only to people you invite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <Field label="Company name" htmlFor="name" required>
              <Input id="name" name="name" required />
            </Field>
            <Field label="Your name" htmlFor="full_name">
              <Input id="full_name" name="full_name" autoComplete="name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NAICS code" htmlFor="naics_code" hint="Optional.">
                <Input id="naics_code" name="naics_code" inputMode="numeric" />
              </Field>
              <Field label="Employees" htmlFor="employee_count" hint="Optional.">
                <Input id="employee_count" name="employee_count" type="number" min={0} />
              </Field>
            </div>
            {state?.error ? <Callout tone="danger">{state.error}</Callout> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating…' : 'Create organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
