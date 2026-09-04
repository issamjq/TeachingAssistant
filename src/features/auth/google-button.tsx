import { Button } from "@/components/ui/button";

export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button className="w-full" variant="outline" disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" className="size-4">
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3a7.46 7.46 0 0 1-11.1-3.93H.9v3.09A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M4.96 14.16a7.2 7.2 0 0 1 0-4.32V6.75H.9a12 12 0 0 0 0 10.5z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 .9 6.75l4.06 3.09A7.16 7.16 0 0 1 12 4.77z" />
      </svg>
      Continue with Google
    </Button>
  );
}
