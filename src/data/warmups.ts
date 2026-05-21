import type { WarmupItem, ExerciseCategory } from '../types';

export const dayWarmups: Record<ExerciseCategory, WarmupItem[]> = {
  push: [
    { id: 'wp-pull-aparts', name: 'Band pull-aparts',                  reps: '15 reps' },
    { id: 'wp-scap-push',   name: 'Scapular push-ups',                 reps: '10 reps' },
    { id: 'wp-dislocates',  name: 'Shoulder dislocates',               reps: '10 reps',  note: 'Band or broomstick' },
    { id: 'wp-wall-slides', name: 'Wall slides',                       reps: '10 reps' },
  ],
  pull: [
    { id: 'wl-pull-aparts', name: 'Band pull-aparts',                  reps: '15 reps' },
    { id: 'wl-scap-pull',   name: 'Scapular pull-ups (shrug only)',    reps: '8 reps' },
    { id: 'wl-catcow-rt',   name: 'Cat-cow with reach-through',        reps: '5/side' },
    { id: 'wl-empty-dl',    name: 'Empty bar deadlift',                reps: '10 reps',  note: 'Before loading — mandatory' },
  ],
  legs: [
    { id: 'wg-lunges',      name: 'Walking lunges with torso twist',   reps: '10/leg' },
    { id: 'wg-glute-b',     name: 'Glute bridges',                     reps: '15 reps' },
    { id: 'wg-lat-lunge',   name: 'Lateral lunges',                    reps: '8/side' },
    { id: 'wg-ankle',       name: 'Ankle rocks against wall',          reps: '10/leg' },
    { id: 'wg-bss',         name: 'Bodyweight Bulgarian split squats', reps: '8/leg' },
    { id: 'wg-pogo',        name: 'Pogo hops',                         reps: '20 reps',  note: 'Small springy jumps — do before box jumps' },
  ],
  core: [
    { id: 'wc-deadbug',     name: 'Dead bugs',                         reps: '10 reps',  note: 'Slow and controlled' },
    { id: 'wc-birddog',     name: 'Bird dogs',                         reps: '8/side' },
    { id: 'wc-inchworm',    name: 'Inchworms',                         reps: '5 reps' },
  ],
  glutes: [
    { id: 'wgt-bridge',    name: 'Glute bridges',                      reps: '15 reps',  note: 'Squeeze and hold 2s at top' },
    { id: 'wgt-clamshell', name: 'Clamshells',                         reps: '12/side' },
    { id: 'wgt-lunge',     name: 'Reverse lunges',                     reps: '10/leg' },
    { id: 'wgt-hip-90',   name: '90/90 hip stretch',                   reps: '60s/side' },
  ],
  back: [
    { id: 'wb-pull-aparts', name: 'Band pull-aparts',                  reps: '15 reps' },
    { id: 'wb-scap-wall',   name: 'Scapular wall slides',              reps: '10 reps' },
    { id: 'wb-cat-cow',     name: 'Cat-cow',                           reps: '8 reps' },
    { id: 'wb-dead-hang',   name: 'Dead hang',                         reps: '20–30 seconds', note: 'Decompress spine before rows' },
  ],
};
