import type { Metadata } from "next";
import AccountRoute from "@/features/account/components/AccountRoute";

export const metadata: Metadata = { title: "Account — Murchid" };

export default async function AccountPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <AccountRoute slug={slug} />;
}
