// super_admin / sub_admin / organisation consoles. No role guard yet —
// that part is a placeholder until the auth/role model
// (docs/00-concept.md) lands. /super-admin wraps itself again in
// SuperAdminShell (its own role guard lives there); this outer wrapper
// is what themes /organisation and /sub-admin, which don't have a
// shell of their own yet.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-app min-h-svh bg-background text-foreground">
      {children}
    </div>
  );
}
