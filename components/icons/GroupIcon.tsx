import * as React from "react";

export default function GroupIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm8 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM4 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm16 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </svg>
  );
}
