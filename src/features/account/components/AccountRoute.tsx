"use client";

import AccountProfile from "@/views/AccountProfile";

// /account/:tab — the profile view owns its own tab chrome.
export default function AccountRoute({ slug = [] }: { slug?: string[] }) {
  return <AccountProfile sub={slug[0] || null} />;
}
