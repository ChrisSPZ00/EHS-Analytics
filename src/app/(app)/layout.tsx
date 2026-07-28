import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // A signed-in user with no profile has not completed onboarding yet, so there is no
  // tenant context and every query would return nothing.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, organizations(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/onboarding');

  const orgName =
    (profile.organizations as { name: string } | null)?.name ?? 'Your organization';

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav
        orgName={orgName}
        userLabel={profile.full_name || user.email || 'Account'}
        role={profile.role}
        signOutAction={signOut}
      />
      <main className="mx-auto w-full max-w-[100rem] flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
