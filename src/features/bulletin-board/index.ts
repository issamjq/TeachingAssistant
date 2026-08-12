// Public surface of the bulletin-board feature. The route segments —
// app/(studio)/bulletin-board/ for the teacher, app/board/[token]/ for
// the class share link — import from here and nothing else.
export { default as BulletinBoardRoute } from "./components/BulletinBoardRoute";
export { default as StudentBoardRoute } from "./components/StudentBoardRoute";
