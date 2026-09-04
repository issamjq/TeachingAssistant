// A `classId` is one subject taught to one division, in one grade, in one
// batch — a single row, not four nested params. Tabs below (lessons, notes,
// exams, quizzes, results, attendance, students, settings) are sibling
// route segments under this layout.
export default function ClassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
