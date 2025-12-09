"use client";

import React from "react";
import clsx from "clsx";

interface PageLoaderProps {
  text?: string;
  fullPage?: boolean;
  className?: string;
  size?: string;
}

export default function PageLoader({
  text,
  fullPage,
  className,
  size,
}: PageLoaderProps) {
  return (
    <div
      className={clsx(
        "flex items-center justify-center",
        fullPage && "min-h-screen bg-white dark:bg-gray-900",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={clsx(
              "animate-spin rounded-full border-4 border-purple-500 border-t-transparent",
              size || "h-8 w-8",
            )}
          />
        </div>
        {text && (
          <span className="text-gray-700 dark:text-gray-300 font-medium text-base">
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
