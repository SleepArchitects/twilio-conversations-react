"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBuildInfo, type BuildInfo } from "@/lib/buildInfo";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    getBuildInfo().then(setBuildInfo);
  }, []);

  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-screen-xl p-4 text-center">
        <span className="block text-sm text-gray-500 dark:text-gray-400">
          © {currentYear} Sleep Architects. All rights reserved.
        </span>
        <div className="mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
          <Link className="hover:underline" href="/legal/privacy">
            Privacy
          </Link>
          <span>|</span>
          <Link className="hover:underline" href="/legal">
            Legal
          </Link>
          <span>|</span>
          <Link className="hover:underline" href="/legal/terms">
            Terms
          </Link>
        </div>
        {buildInfo && (
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {buildInfo.displayVersion} • {buildInfo.commitHash}
          </div>
        )}
      </div>
    </footer>
  );
}
