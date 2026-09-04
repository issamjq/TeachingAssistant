export interface ClassRecord {
  id: string;
  batch: string;
  grade: string;
  division: string;
  subject: string;
  studentCount: number;
}

export const CLASSES: ClassRecord[] = [
  { id: "c1", batch: "2025-26", grade: "Grade 9", division: "A", subject: "English", studentCount: 28 },
  { id: "c2", batch: "2025-26", grade: "Grade 9", division: "A", subject: "Maths", studentCount: 28 },
  { id: "c3", batch: "2025-26", grade: "Grade 10", division: "B", subject: "Social Studies", studentCount: 31 },
  { id: "c4", batch: "2025-26", grade: "Grade 10", division: "B", subject: "English", studentCount: 31 },
  { id: "c5", batch: "2025-26", grade: "Grade 10", division: "C", subject: "Maths", studentCount: 26 },
  { id: "c6", batch: "2026-27", grade: "Grade 9", division: "A", subject: "Science", studentCount: 24 },
];

export function getClass(id: string): ClassRecord {
  return CLASSES.find((c) => c.id === id) ?? CLASSES[0];
}

export function classLabel(c: ClassRecord): string {
  return `${c.grade} · Div ${c.division} · ${c.subject}`;
}

export function classesByBatch(): Record<string, ClassRecord[]> {
  return CLASSES.reduce<Record<string, ClassRecord[]>>((acc, c) => {
    (acc[c.batch] ??= []).push(c);
    return acc;
  }, {});
}

export interface StudentRecord {
  id: string;
  name: string;
  rollNo: string;
}

export const ROSTER: StudentRecord[] = [
  { id: "s1", name: "Aisha Al Marri", rollNo: "01" },
  { id: "s2", name: "Yousef Haddad", rollNo: "02" },
  { id: "s3", name: "Fatima Noor", rollNo: "03" },
  { id: "s4", name: "Omar Siddiqui", rollNo: "04" },
  { id: "s5", name: "Layla Khan", rollNo: "05" },
  { id: "s6", name: "Rayan Abdullah", rollNo: "06" },
  { id: "s7", name: "Maya Fernandes", rollNo: "07" },
  { id: "s8", name: "Zayd Ibrahim", rollNo: "08" },
];
