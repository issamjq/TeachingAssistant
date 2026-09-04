export default async function ClassStudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Students</h1>
      <p>Class {classId}. Invite-only — no self-registration.</p>
    </main>
  );
}
