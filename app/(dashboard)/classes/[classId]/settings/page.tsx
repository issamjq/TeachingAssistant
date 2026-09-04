export default async function ClassSettingsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Class settings</h1>
      <p>Class {classId}. Student CRUD and other class-level configuration.</p>
    </main>
  );
}
