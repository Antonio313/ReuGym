import type { Exercise } from '../types';

export const stretches: Exercise[] = [
  // ─── Push pre-workout ─────────────────────────────────────────
  {
    id: 'push-pre-1', name: 'Band Pull-Aparts',
    category: 'general', type: 'accessory', muscles: ['shoulders', 'back'],
    defaultRepRange: [15, 15], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true,
  },
  {
    id: 'push-pre-2', name: 'Arm Circles',
    category: 'push', type: 'accessory', muscles: ['shoulders'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, notes: 'Each direction',
  },
  {
    id: 'push-pre-3', name: 'Shoulder Dislocates',
    category: 'push', type: 'accessory', muscles: ['shoulders'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Band or broomstick',
  },
  {
    id: 'push-pre-4', name: 'Scapular Push-Ups',
    category: 'push', type: 'accessory', muscles: ['back', 'shoulders'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Arms straight, just depress and elevate scapula',
  },
  {
    id: 'push-pre-5', name: 'Wrist Circles',
    category: 'push', type: 'accessory', muscles: ['forearms'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, notes: 'Each direction',
  },

  // ─── Push post-workout ────────────────────────────────────────
  {
    id: 'push-post-1', name: 'Doorway Chest Stretch',
    category: 'push', type: 'isometric', muscles: ['chest', 'shoulders'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Elbow at 90°, rotate away from wall — per side',
  },
  {
    id: 'push-post-2', name: 'Overhead Triceps Stretch',
    category: 'push', type: 'isometric', muscles: ['triceps'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'push-post-3', name: 'Cross-Body Shoulder Stretch',
    category: 'push', type: 'isometric', muscles: ['shoulders'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'push-post-4', name: 'Sleeper Stretch',
    category: 'push', type: 'isometric', muscles: ['shoulders'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Lie on side — internal rotation recovery — per side',
  },
  {
    id: 'push-post-5', name: 'Prayer Stretch (Wrists)',
    category: 'push', type: 'isometric', muscles: ['forearms'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Palms together, press down',
  },

  // ─── Pull pre-workout ─────────────────────────────────────────
  {
    id: 'pull-pre-2', name: 'Scapular Wall Slides',
    category: 'pull', type: 'accessory', muscles: ['back', 'shoulders'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Back flat against wall throughout',
  },
  {
    id: 'pull-pre-3', name: 'Cat-Cow with Reach-Through',
    category: 'general', type: 'accessory', muscles: ['back'],
    defaultRepRange: [5, 5], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'pull-pre-4', name: 'Thoracic Rotations',
    category: 'general', type: 'accessory', muscles: ['back'],
    defaultRepRange: [8, 8], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Rotate through upper back, not lower — per side',
  },
  {
    id: 'pull-pre-5', name: 'Dead Hang',
    category: 'general', type: 'isometric', muscles: ['back', 'forearms'],
    defaultRepRange: [20, 30], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Mandatory before rows — decompresses spine',
  },

  // ─── Pull post-workout ────────────────────────────────────────
  {
    id: 'pull-post-1', name: 'Lat Overhead Lean Stretch',
    category: 'pull', type: 'isometric', muscles: ['back'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Arm overhead, lean away to feel the lat — per side',
  },
  {
    id: 'pull-post-2', name: "Child's Pose",
    category: 'general', type: 'isometric', muscles: ['back'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Arms extended, let lats stretch fully',
  },
  {
    id: 'pull-post-3', name: 'Thread-the-Needle',
    category: 'general', type: 'isometric', muscles: ['back'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Upper back rotation — per side',
  },
  {
    id: 'pull-post-4', name: 'Biceps Wall Stretch',
    category: 'pull', type: 'isometric', muscles: ['biceps'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Palm on wall, rotate away — per side',
  },
  {
    id: 'pull-post-5', name: 'Doorway Posterior Shoulder',
    category: 'pull', type: 'isometric', muscles: ['shoulders'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },

  // ─── Legs pre-workout ─────────────────────────────────────────
  {
    id: 'legs-pre-1', name: 'Leg Swings Front-to-Back',
    category: 'legs', type: 'accessory', muscles: ['hamstrings', 'glutes'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per leg',
  },
  {
    id: 'legs-pre-2', name: 'Leg Swings Side-to-Side',
    category: 'legs', type: 'accessory', muscles: ['glutes', 'quads'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per leg',
  },
  {
    id: 'legs-pre-3', name: 'Walking Lunges',
    category: 'legs', type: 'accessory', muscles: ['quads', 'glutes'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per leg',
  },
  {
    id: 'legs-pre-4', name: 'Hip Circles',
    category: 'general', type: 'accessory', muscles: ['glutes'],
    defaultRepRange: [8, 8], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'legs-pre-5', name: 'Ankle Circles',
    category: 'legs', type: 'accessory', muscles: ['calves'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per ankle',
  },
  {
    id: 'legs-pre-6', name: 'Pogo Hops',
    category: 'legs', type: 'plyo', muscles: ['calves'],
    defaultRepRange: [20, 20], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Small springy hops — primes tendons before box jumps',
  },

  // ─── Legs post-workout ────────────────────────────────────────
  {
    id: 'legs-post-1', name: 'Standing Quad Stretch',
    category: 'legs', type: 'isometric', muscles: ['quads'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'legs-post-2', name: 'Standing Hamstring Fold',
    category: 'legs', type: 'isometric', muscles: ['hamstrings'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Soft knees, let spine hang',
  },
  {
    id: 'legs-post-3', name: 'Figure-4 Glute Stretch',
    category: 'general', type: 'isometric', muscles: ['glutes'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'legs-post-4', name: 'Hip Flexor Kneeling Lunge',
    category: 'general', type: 'isometric', muscles: ['quads', 'glutes'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Back knee on ground — targets rectus femoris — per side',
  },
  {
    id: 'legs-post-5', name: 'Calf Stretch (Wall)',
    category: 'legs', type: 'isometric', muscles: ['calves'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'legs-post-6', name: 'Pigeon Pose',
    category: 'general', type: 'isometric', muscles: ['glutes'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 25,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Breathe into the hip — per side',
  },

  // ─── Core pre-workout ─────────────────────────────────────────
  {
    id: 'core-pre-1', name: 'Cat-Cow',
    category: 'general', type: 'accessory', muscles: ['back', 'core'],
    defaultRepRange: [8, 8], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true,
  },
  {
    id: 'core-pre-2', name: 'Dead Bugs',
    category: 'core', type: 'accessory', muscles: ['core'],
    defaultRepRange: [8, 8], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Exhale on lower — slow and controlled',
  },
  {
    id: 'core-pre-3', name: 'Bird Dogs',
    category: 'core', type: 'accessory', muscles: ['core', 'back'],
    defaultRepRange: [6, 6], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'core-pre-5', name: 'Inchworms',
    category: 'core', type: 'accessory', muscles: ['core', 'hamstrings'],
    defaultRepRange: [5, 5], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true,
  },

  // ─── Core post-workout ────────────────────────────────────────
  {
    id: 'core-post-2', name: 'Cobra / Upward Dog',
    category: 'core', type: 'isometric', muscles: ['core'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Counteract all the core flexion',
  },
  {
    id: 'core-post-3', name: 'Supine Spinal Twist',
    category: 'core', type: 'isometric', muscles: ['back', 'core'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'core-post-5', name: 'Seated Forward Fold',
    category: 'core', type: 'isometric', muscles: ['hamstrings', 'back'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Decompress spine, stretch hamstrings and lower back',
  },

  // ─── Glutes pre-workout ───────────────────────────────────────
  {
    id: 'glutes-pre-1', name: 'Glute Bridges (Activation)',
    category: 'glutes', type: 'accessory', muscles: ['glutes'],
    defaultRepRange: [15, 15], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, notes: 'Squeeze for 2s at top',
  },
  {
    id: 'glutes-pre-2', name: 'Clamshells',
    category: 'glutes', type: 'accessory', muscles: ['glutes'],
    defaultRepRange: [12, 12], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'glutes-pre-3', name: 'Fire Hydrants',
    category: 'glutes', type: 'accessory', muscles: ['glutes'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 10,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'glutes-pre-4', name: 'Dynamic Hip Flexor Lunges',
    category: 'glutes', type: 'accessory', muscles: ['glutes', 'quads'],
    defaultRepRange: [5, 5], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'glutes-pre-5', name: '90/90 Hip Switches',
    category: 'glutes', type: 'accessory', muscles: ['glutes'],
    defaultRepRange: [8, 8], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Slowly rotate between both hip positions',
  },

  // ─── Glutes post-workout ──────────────────────────────────────
  {
    id: 'glutes-post-2', name: 'Supine Hip Flexor Stretch',
    category: 'glutes', type: 'isometric', muscles: ['glutes', 'quads'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },
  {
    id: 'glutes-post-4', name: 'Butterfly Stretch',
    category: 'glutes', type: 'isometric', muscles: ['glutes'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Feet together, lean forward for inner thigh and glute',
  },
  {
    id: 'glutes-post-5', name: 'Seated Cross-Leg Glute Stretch',
    category: 'glutes', type: 'isometric', muscles: ['glutes'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Per side',
  },

  // ─── Back pre-workout ─────────────────────────────────────────
  {
    id: 'back-pre-2', name: 'Scapular Wall Slides (Back Day)',
    category: 'back', type: 'accessory', muscles: ['back', 'shoulders'],
    defaultRepRange: [10, 10], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, notes: 'Back flat against wall throughout',
  },

  // ─── Back post-workout ────────────────────────────────────────
  {
    id: 'back-post-1', name: 'Lat Overhead Lean Stretch (Back)',
    category: 'back', type: 'isometric', muscles: ['back'],
    defaultRepRange: [45, 45], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Arm overhead, lean away — feel the lat — per side',
  },
  {
    id: 'back-post-4', name: 'Doorway Chest Stretch (Back Day)',
    category: 'back', type: 'isometric', muscles: ['chest', 'shoulders'],
    defaultRepRange: [30, 30], startingWeightKg: 0, restSeconds: 15,
    isBodyweight: true, isStretch: true, isTimed: true, isPerSide: true, notes: 'Releases anterior shoulder tightness from rows — per side',
  },
  {
    id: 'back-post-5', name: 'Thoracic Foam Roll',
    category: 'back', type: 'isometric', muscles: ['back'],
    defaultRepRange: [60, 60], startingWeightKg: 0, restSeconds: 20,
    isBodyweight: true, isStretch: true, isTimed: true, notes: 'Or self-massage — works thoracic extensors',
  },
];

export const stretchMap = new Map(stretches.map((s) => [s.id, s]));
