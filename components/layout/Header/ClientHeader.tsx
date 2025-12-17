"use client";

import type { ReactNode } from "react";

interface ClientHeaderProps {
  nickname?: string;
  children: ReactNode;
}

// User/login area removed per request; this component now only renders children.
export default function ClientHeader({ children }: ClientHeaderProps) {
  return <>{children}</>;
}
