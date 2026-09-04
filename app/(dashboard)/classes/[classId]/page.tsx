export default async function ClassLessonsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Lessons</h1>
      <p>Class {classId}.</p>
    </main>
  );
}
