import { PageHeader } from "@/components/layout/page-header";
import { GoalPlannerForm } from "@/features/goal-planner/goal-planner-form";

export default function GoalPlannerPage() {
  return (
    <div>
      <PageHeader
        title="Goal Planner"
        description="Curriculum, a prompt, or documents in — a full term's material out, ready for your approval."
      />
      <div className="p-6 md:p-8">
        <GoalPlannerForm />
      </div>
    </div>
  );
}
