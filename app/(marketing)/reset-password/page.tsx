import type { Metadata } from "next";
import ResetPassword from "@/features/marketing/ResetPassword";

export const metadata: Metadata = { title: "Set a new password — Murchid" };

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
