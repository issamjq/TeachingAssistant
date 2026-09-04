export default async function ClassResultsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Results</h1>
      <p>Class {classId}.</p>
    </main>
  );
}
