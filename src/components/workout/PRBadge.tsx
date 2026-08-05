import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// The one deliberately bold moment in the app — everything else stays quiet.
export function PRBadge({ show }: { show: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          className="font-body font-medium uppercase tracking-widest px-2 py-0.5"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
          transition={reduceMotion
            ? { duration: 0.15 }
            : { type: 'spring', stiffness: 420, damping: 18 }}
          style={{
            fontSize: 'var(--text-micro)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
          }}
        >
          PR!
        </motion.span>
      )}
    </AnimatePresence>
  );
}
