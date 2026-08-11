// Shapes for the bulletin board. Rows come back from /api/bulletin in
// exactly this form — see listBulletin in src/lib/data/entities.ts.

export type BulletinKind = "notice" | "event" | "reminder" | "celebration";
export type BulletinStatus = "published" | "archived";

export interface BulletinPost {
  id: string;
  title: string;
  body: string | null;
  kind: BulletinKind;
  status: BulletinStatus;
  pinned: boolean;
  /** Audience. Null means the whole board — same vocabulary as schedule_entries. */
  grade: string | null;
  section: string | null;
  /** ISO yyyy-mm-dd, both optional. */
  event_on: string | null;
  expires_on: string | null;
  created_at: string;
  updated_at: string;
}

/** What the editor sends. Everything but the title is optional. */
export interface BulletinDraft {
  title: string;
  body?: string | null;
  kind?: BulletinKind;
  pinned?: boolean;
  grade?: string | null;
  section?: string | null;
  event_on?: string | null;
  expires_on?: string | null;
}

export type BulletinPatch = Partial<BulletinDraft> & { status?: BulletinStatus };
