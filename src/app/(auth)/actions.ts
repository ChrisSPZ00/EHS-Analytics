'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type AuthState = { error: string } | null;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/incidents');

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect(next.startsWith('/') ? next : '/incidents');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };
  if (password.length < 8) return { error: 'Use at least 8 characters.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Creates the organization and makes the caller its owner.
 *
 * Note what is NOT passed: an organization id. bootstrap_organization() derives it
 * entirely from auth.uid(), so there is no parameter here a client could tamper with.
 */
export async function createOrganization(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const naics = String(formData.get('naics_code') ?? '').trim();
  const employeeCountRaw = String(formData.get('employee_count') ?? '').trim();

  if (!name) return { error: 'Enter your company name.' };

  const employeeCount = employeeCountRaw ? Number(employeeCountRaw) : null;
  if (employeeCount !== null && (!Number.isFinite(employeeCount) || employeeCount < 0)) {
    return { error: 'Employee count must be a positive number.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('bootstrap_organization', {
    p_org_name: name,
    p_full_name: fullName || undefined,
    p_naics_code: naics || undefined,
    p_employee_count: employeeCount ?? undefined,
  });

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/incidents');
}
