export default async function ClassNotesPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <main>
      <h1>Notes &amp; text</h1>
      <p>
        Class {classId}. Picked from the shared deck or uploaded and
        AI-extracted. Doubts anchor to a position in the document; an
        approved answer becomes visible to the whole class.
      </p>
    </main>
  );
}
