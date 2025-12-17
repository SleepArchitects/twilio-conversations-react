import * as React from "react";

export default function UngroupIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM16 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM4 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM20 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fillOpacity="0.3"
      />
      <line
        x1="2"
        y1="2"
        x2="22"
        y2="22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
