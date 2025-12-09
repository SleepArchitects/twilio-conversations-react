import React from "react";

interface CardViewIconProps {
  className?: string;
}

export default function CardViewIcon({ className = "" }: CardViewIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="14" rx="2" width="16" x="4" y="3" />
      <rect height="14" rx="2" width="16" x="4" y="8" />
      <rect height="14" rx="2" width="16" x="4" y="13" />
    </svg>
  );
}
