/**
 * components/concierge/motion.ts — entrance choreography shared by the
 * concierge screen's strip and columns.
 *
 * Intentionally different from lib/motionPresets' fade-up itemVariants
 * (opacity-only 0.6s / 0.09 stagger vs fade-up-28px 0.7s / 0.14) — do NOT
 * unify the values, that would change visible motion (dry-audit B2).
 */

export const queendomItemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
};

export const queendomContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

/** Counter-entrance base delay added per column, left → right (0 / 150 / 300 ms). */
export const QUEENDOM_ENTRANCE_DELAY_MS = 150;
