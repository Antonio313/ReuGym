// One-time seed: copies the current static exercise/stretch library into the
// new shared default_exercises table, preserving ids exactly so any existing
// per-user custom_exercises override still matches correctly. Run this once,
// before shipping the code that reads from default_exercises instead of the
// static files — after that, use the "Sync to defaults" button in Settings
// (admin only) to push further additions/edits without needing this script
// again.
//
// Run yourself — needs your Supabase service role key:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-default-exercises.mjs
//
// Safe to re-run: it's a plain upsert by id.

import { createClient } from '@supabase/supabase-js';
import { exercises } from '../src/data/exercises.ts';
import { stretches } from '../src/data/stretches.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toRow(exercise) {
  return {
    id:                 exercise.id,
    name:               exercise.name,
    category:           exercise.category,
    type:               exercise.type,
    muscles:            exercise.muscles,
    default_rep_range:  exercise.defaultRepRange ?? null,
    rest_seconds:       exercise.restSeconds ?? null,
    is_bodyweight:      exercise.isBodyweight ?? false,
    is_cable:           exercise.isCable ?? false,
    is_timed:           exercise.isTimed ?? false,
    is_stretch:         exercise.isStretch ?? false,
    video_url:          exercise.videoUrl ?? null,
  };
}

async function main() {
  const rows = [...exercises, ...stretches].map(toRow);
  console.log(`Seeding ${rows.length} rows (${exercises.length} exercises, ${stretches.length} stretches)...`);

  const { error } = await supabase.from('default_exercises').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log('Done.');
}

main();
