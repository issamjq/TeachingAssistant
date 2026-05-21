import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// Wrap any view that changes by key. The key flip triggers a fade +
// 8px slide, ease-out 280ms in / 200ms out. Reduced-motion users get
// an instant swap (framer-motion respects prefers-reduced-motion when
// transition.duration is short).
export function PageTransition({ pageKey, children, className = "" }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1],
          exit: { duration: 0.2, ease: [0.4, 0, 1, 1] },
        }}
        className={className}
        style={{ minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
