import { cn } from "@/lib/utils";

export function IconButton({
  onClick,
  title,
  variant = "ghost",
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: "ghost" | "destructive";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "destructive"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
