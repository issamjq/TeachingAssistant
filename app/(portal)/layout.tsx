// Student-facing, invite-only. No nav yet — placeholder until the
// auth/role model (docs/00-concept.md) lands.
export default function PortalLayout({
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
