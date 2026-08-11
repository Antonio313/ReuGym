// One-off migration: creates a real Supabase Auth user for every row in
// public.users, preserving the existing row's id so every user_id foreign
// key (workout_sessions, logged_sets, custom_exercises, ...) and every
// per-user Dexie DB (keyed "ReuGymDB_${userId}") stays valid — nothing else
// in the schema or local storage needs to change.
//
// Everyone gets the same default password ("password") and is flagged
// must_change_password so the app forces them through a real password on
// first sign-in. reuelrichards1@gmail.com additionally gets
// app_metadata.is_admin = true.
//
// Run this yourself — it needs your Supabase service role key, which should
// never be committed or handled by anything other than you:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-users-to-auth.mjs
//
// Safe to re-run: existing auth users are skipped, not recreated.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'password';
const ADMIN_EMAIL = 'reuelrichards1@gmail.com';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: rows, error } = await supabase.from('users').select('id, email');
  if (error) {
    console.error('Failed to read public.users:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} row(s) in public.users.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const migratedIds = [];

  for (const row of rows) {
    const email = row.email.toLowerCase().trim();
    const { error: createError } = await supabase.auth.admin.createUser({
      id: row.id,
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      app_metadata: email === ADMIN_EMAIL ? { is_admin: true } : undefined,
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes('already been registered')) {
        console.log(`Skipped (already exists): ${email}`);
        skipped += 1;
      } else {
        console.error(`Failed for ${email}: ${createError.message}`);
        failed += 1;
      }
      continue;
    }

    console.log(`Created auth user: ${email}`);
    created += 1;
    migratedIds.push(row.id);
  }

  if (migratedIds.length > 0) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ must_change_password: true })
      .in('id', migratedIds);
    if (updateError) {
      console.error('Failed to set must_change_password:', updateError.message);
    }
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}, failed: ${failed}.`);
}

main();
