// The handoff from the standalone /curriculum page to the goal composer.
//
// Picking a unit on /curriculum means "start a goal from this", but the
// two screens are deliberately separate features (browsing a sequence
// is not the same act as writing a goal) with no import path between
// them. sessionStorage carries the pick across the navigation instead —
// tab-scoped, so it can't leak a stale pick into a different tab's goal,
// and read-once: GoalsView consumes and clears it on mount.
export const CURRICULUM_SEED_KEY = "murchid.curriculum.pending-goal";

export type CurriculumSeed = {
  title: string;
  brief: string;
  timeline?: string;
  grade: string;
  subject: string;
};
