import React from "react";
import { AnimatePresence, motion } from "framer-motion";

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
