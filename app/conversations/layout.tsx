import React from "react";

// Force dynamic rendering to prevent aggressive caching (fixes blank page issues)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
