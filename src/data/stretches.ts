import type { DayStretch, ExerciseCategory } from '../types';

type DayStretchData = { pre: DayStretch[]; post: DayStretch[] };

export const dayStretches: Record<ExerciseCategory, DayStretchData> = {
  push: {
    pre: [
      { id: 'push-pre-1', name: 'Band Pull-Aparts',            reps: '15 reps',               restSeconds: 10 },
      { id: 'push-pre-2', name: 'Arm Circles',                  reps: '10 reps each direction', restSeconds: 10 },
      { id: 'push-pre-3', name: 'Shoulder Dislocates',          reps: '10 reps',               restSeconds: 15, note: 'Band or broomstick' },
      { id: 'push-pre-4', name: 'Scapular Push-Ups',            reps: '10 reps',               restSeconds: 15, note: 'Arms straight, just depress and elevate scapula' },
      { id: 'push-pre-5', name: 'Wrist Circles',                reps: '10 reps each direction', restSeconds: 10 },
    ],
    post: [
      { id: 'push-post-1', name: 'Doorway Chest Stretch',       reps: '45s/side',  restSeconds: 20, note: 'Elbow at 90°, rotate away from wall' },
      { id: 'push-post-2', name: 'Overhead Triceps Stretch',    reps: '30s/side',  restSeconds: 15 },
      { id: 'push-post-3', name: 'Cross-Body Shoulder Stretch', reps: '30s/side',  restSeconds: 15 },
      { id: 'push-post-4', name: 'Sleeper Stretch',             reps: '30s/side',  restSeconds: 20, note: 'Lie on side — internal rotation recovery' },
      { id: 'push-post-5', name: 'Prayer Stretch (Wrists)',     reps: '30 seconds', restSeconds: 15, note: 'Palms together, press down' },
    ],
  },

  pull: {
    pre: [
      { id: 'pull-pre-1', name: 'Band Pull-Aparts',             reps: '15 reps',       restSeconds: 10 },
      { id: 'pull-pre-2', name: 'Scapular Wall Slides',         reps: '10 reps',       restSeconds: 15, note: 'Back flat against wall throughout' },
      { id: 'pull-pre-3', name: 'Cat-Cow with Reach-Through',   reps: '5/side',        restSeconds: 10 },
      { id: 'pull-pre-4', name: 'Thoracic Rotations',           reps: '8/side',        restSeconds: 10, note: 'Rotate through upper back, not lower' },
      { id: 'pull-pre-5', name: 'Dead Hang',                    reps: '20–30 seconds', restSeconds: 20, note: 'Mandatory before rows — decompresses spine' },
    ],
    post: [
      { id: 'pull-post-1', name: 'Lat Overhead Lean Stretch',   reps: '45s/side',  restSeconds: 20, note: 'Arm overhead, lean away to feel the lat' },
      { id: 'pull-post-2', name: "Child's Pose",                reps: '60 seconds', restSeconds: 20, note: 'Arms extended, let lats stretch fully' },
      { id: 'pull-post-3', name: 'Thread-the-Needle',           reps: '45s/side',  restSeconds: 20, note: 'Upper back rotation' },
      { id: 'pull-post-4', name: 'Biceps Wall Stretch',         reps: '30s/side',  restSeconds: 15, note: 'Palm on wall, rotate away' },
      { id: 'pull-post-5', name: 'Doorway Posterior Shoulder',  reps: '30s/side',  restSeconds: 15 },
    ],
  },

  legs: {
    pre: [
      { id: 'legs-pre-1', name: 'Leg Swings Front-to-Back',    reps: '10/leg',   restSeconds: 10 },
      { id: 'legs-pre-2', name: 'Leg Swings Side-to-Side',     reps: '10/leg',   restSeconds: 10 },
      { id: 'legs-pre-3', name: 'Walking Lunges',              reps: '10/leg',   restSeconds: 15 },
      { id: 'legs-pre-4', name: 'Hip Circles',                 reps: '8/side',   restSeconds: 10 },
      { id: 'legs-pre-5', name: 'Ankle Circles',               reps: '10/ankle', restSeconds: 10 },
      { id: 'legs-pre-6', name: 'Pogo Hops',                   reps: '20 reps',  restSeconds: 15, note: 'Small springy hops — primes tendons before box jumps' },
    ],
    post: [
      { id: 'legs-post-1', name: 'Standing Quad Stretch',      reps: '45s/side',  restSeconds: 20 },
      { id: 'legs-post-2', name: 'Standing Hamstring Fold',    reps: '60 seconds', restSeconds: 20, note: 'Soft knees, let spine hang' },
      { id: 'legs-post-3', name: 'Figure-4 Glute Stretch',     reps: '45s/side',  restSeconds: 20 },
      { id: 'legs-post-4', name: 'Hip Flexor Kneeling Lunge',  reps: '45s/side',  restSeconds: 20, note: 'Back knee on ground — targets rectus femoris' },
      { id: 'legs-post-5', name: 'Calf Stretch (Wall)',        reps: '30s/side',  restSeconds: 15 },
      { id: 'legs-post-6', name: 'Pigeon Pose',                reps: '60s/side',  restSeconds: 25, note: 'Breathe into the hip' },
    ],
  },

  core: {
    pre: [
      { id: 'core-pre-1', name: 'Cat-Cow',                     reps: '8 reps',  restSeconds: 10 },
      { id: 'core-pre-2', name: 'Dead Bugs',                   reps: '8 reps',  restSeconds: 15, note: 'Exhale on lower — slow and controlled' },
      { id: 'core-pre-3', name: 'Bird Dogs',                   reps: '6/side',  restSeconds: 10 },
      { id: 'core-pre-4', name: 'Hip Circles',                 reps: '8/side',  restSeconds: 10 },
      { id: 'core-pre-5', name: 'Inchworms',                   reps: '5 reps',  restSeconds: 15 },
    ],
    post: [
      { id: 'core-post-1', name: "Child's Pose",               reps: '60 seconds', restSeconds: 20 },
      { id: 'core-post-2', name: 'Cobra / Upward Dog',         reps: '45 seconds', restSeconds: 20, note: 'Counteract all the core flexion' },
      { id: 'core-post-3', name: 'Supine Spinal Twist',        reps: '45s/side',   restSeconds: 20 },
      { id: 'core-post-4', name: 'Hip Flexor Kneeling Stretch',reps: '45s/side',   restSeconds: 20 },
      { id: 'core-post-5', name: 'Seated Forward Fold',        reps: '60 seconds', restSeconds: 20, note: 'Decompress spine, stretch hamstrings and lower back' },
    ],
  },

  glutes: {
    pre: [
      { id: 'glutes-pre-1', name: 'Glute Bridges (Activation)', reps: '15 reps', restSeconds: 10, note: 'Squeeze for 2s at top' },
      { id: 'glutes-pre-2', name: 'Clamshells',                 reps: '12/side', restSeconds: 10 },
      { id: 'glutes-pre-3', name: 'Fire Hydrants',              reps: '10/side', restSeconds: 10 },
      { id: 'glutes-pre-4', name: 'Dynamic Hip Flexor Lunges',  reps: '5/side',  restSeconds: 15 },
      { id: 'glutes-pre-5', name: '90/90 Hip Switches',         reps: '8 reps',  restSeconds: 15, note: 'Slowly rotate between both hip positions' },
    ],
    post: [
      { id: 'glutes-post-1', name: 'Pigeon Pose',               reps: '60s/side',   restSeconds: 25, note: 'Breathe into the hip — deepest glute stretch' },
      { id: 'glutes-post-2', name: 'Figure-4 Glute Stretch',    reps: '45s/side',   restSeconds: 20 },
      { id: 'glutes-post-3', name: 'Supine Hip Flexor Stretch', reps: '45s/side',   restSeconds: 20 },
      { id: 'glutes-post-4', name: 'Butterfly Stretch',         reps: '60 seconds', restSeconds: 20, note: 'Feet together, lean forward for inner thigh and glute' },
      { id: 'glutes-post-5', name: 'Seated Cross-Leg Glute Stretch', reps: '45s/side', restSeconds: 20 },
    ],
  },

  back: {
    pre: [
      { id: 'back-pre-1', name: 'Band Pull-Aparts',             reps: '15 reps',       restSeconds: 10 },
      { id: 'back-pre-2', name: 'Scapular Wall Slides',         reps: '10 reps',       restSeconds: 15, note: 'Back flat against wall throughout' },
      { id: 'back-pre-3', name: 'Cat-Cow',                      reps: '8 reps',        restSeconds: 10 },
      { id: 'back-pre-4', name: 'Thoracic Rotations',           reps: '8/side',        restSeconds: 10 },
      { id: 'back-pre-5', name: 'Dead Hang',                    reps: '20–30 seconds', restSeconds: 20, note: 'Mandatory before rows — decompresses spine' },
    ],
    post: [
      { id: 'back-post-1', name: 'Lat Overhead Lean Stretch',   reps: '45s/side',   restSeconds: 20, note: 'Arm overhead, lean away — feel the lat' },
      { id: 'back-post-2', name: "Child's Pose (Arms Extended)", reps: '60 seconds', restSeconds: 20 },
      { id: 'back-post-3', name: 'Thread-the-Needle',           reps: '45s/side',   restSeconds: 20 },
      { id: 'back-post-4', name: 'Doorway Chest Stretch',       reps: '30s/side',   restSeconds: 15, note: 'Releases anterior shoulder tightness from rows' },
      { id: 'back-post-5', name: 'Thoracic Foam Roll',          reps: '60 seconds', restSeconds: 20, note: 'Or self-massage — works thoracic extensors' },
    ],
  },
};
