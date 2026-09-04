export default async function ClassAttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Attendance</h1>
      <p>Class {classId}.</p>
    </main>
  );
}
