import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// This test writes to the SHARED default_exercises table on purpose (to
// verify auto-promotion + dedup), so everything here uses obviously-fake
// names and gets fully cleaned up at the end regardless of outcome.

const { data: existing } = await supabase.from('default_exercises').select('name').ilike('name', 'Diamond Push-Up');
console.log('Pre-existing "Diamond Push-Up" in defaults:', existing?.length ?? 0);

const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
  email: `claude-dedup-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  email_confirm: true,
});
if (createErr) { console.error('createUser failed:', createErr.message); process.exit(1); }
const testUserId = userData.user.id;
console.log('Test user:', testUserId);

const idA = 'zzTestDedupA' + Date.now().toString(36);
const idB = 'zzTestDedupB' + Date.now().toString(36);
const idC = 'zzTestDedupC' + Date.now().toString(36);

const proposedActions = [
  // A: exact duplicate of something plausibly already in the library
  { kind: 'create_exercise', id: idA, label: 'Create exercise: Diamond Push-Up (push)', name: 'Diamond Push-Up', category: 'push', exerciseType: 'accessory', muscles: ['chest', 'triceps'], isStretch: false },
  // B and C: two brand-new, identically-named (with whitespace/case noise) exercises within the SAME batch
  { kind: 'create_exercise', id: idB, label: 'Create exercise: Zztest Wobble Curl (pull)', name: 'ZzTest Wobble Curl', category: 'pull', exerciseType: 'accessory', muscles: ['biceps'], isStretch: false },
  { kind: 'create_exercise', id: idC, label: 'Create exercise: zztest wobble curl (pull)', name: '  zztest   wobble curl  ', category: 'pull', exerciseType: 'accessory', muscles: ['biceps'], isStretch: false },
];

console.log('\n--- Calling ai-assistant edge function (mode: execute) ---');
const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
  body: JSON.stringify({ userId: testUserId, mode: 'execute', proposedActions }),
});
console.log('HTTP status:', res.status);
const data = await res.json();
console.log('response:', JSON.stringify(data));

// Check what actually landed in default_exercises
const { data: afterA } = await supabase.from('default_exercises').select('id, name').eq('id', idA);
const { data: afterB } = await supabase.from('default_exercises').select('id, name').eq('id', idB);
const { data: afterC } = await supabase.from('default_exercises').select('id, name').eq('id', idC);
console.log('\nDiamond Push-Up (idA) promoted (should be NO — duplicate of existing):', afterA?.length ?? 0);
console.log('Wobble Curl (idB) promoted (should be YES — first of its name):', afterB?.length ?? 0, afterB);
console.log('Wobble Curl (idC) promoted (should be NO — duplicate of idB within same batch):', afterC?.length ?? 0);

// Cleanup — delete anything this test could have written, regardless of outcome
console.log('\n--- Cleaning up ---');
await supabase.from('default_exercises').delete().in('id', [idA, idB, idC]);
await supabase.from('custom_exercises').delete().eq('user_id', testUserId);
await supabase.from('users').delete().eq('id', testUserId);
await supabase.auth.admin.deleteUser(testUserId);
const { data: checkGone } = await supabase.from('default_exercises').select('id').in('id', [idA, idB, idC]);
console.log('Remaining test rows in default_exercises:', checkGone?.length ?? 0);
console.log('Done.');
