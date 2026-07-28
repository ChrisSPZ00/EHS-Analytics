'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';

import {
  correctiveActionSchema,
  incidentSchema,
} from '@/lib/domain/incidents';
import { createClient } from '@/lib/supabase/server';

export type FormState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
  | null;

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * All of these write through the user's own session, so RLS decides what is permitted.
 * None of them accepts or sets organization_id -- the BEFORE INSERT trigger assigns it.
 */
export async function createIncident(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('incidents')
    .insert(parsed.data as never)
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath('/incidents');
  redirect(`/incidents/${data.id}`);
}

export async function updateIncident(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('incidents')
    .update(parsed.data as never)
    .eq('id', id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/incidents');
  revalidatePath(`/incidents/${id}`);
  redirect(`/incidents/${id}`);
}

export async function deleteIncident(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('incidents').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/incidents');
  redirect('/incidents');
}

export async function saveCorrectiveAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get('id') ?? '') || null;
  const parsed = correctiveActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('corrective_actions').update(parsed.data as never).eq('id', id)
    : await supabase.from('corrective_actions').insert(parsed.data as never);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  revalidatePath('/corrective-actions');
  return { ok: true };
}

export async function deleteCorrectiveAction(id: string, incidentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('corrective_actions').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath('/corrective-actions');
}

/**
 * Inline classification from the needs-classification queue.
 *
 * `null` is an accepted value, not a missing one: a user may clear a classification back
 * to unclassified, and that has to be expressible.
 */
export async function setHierarchyOfControls(
  actionId: string,
  value: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('corrective_actions')
    .update({ hierarchy_of_controls: value })
    .eq('id', actionId);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/corrective-actions');
  revalidatePath('/corrective-actions/needs-classification');
  return { ok: true };
}
