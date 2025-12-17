"use client";

import { Moon, MoonStar, Star, Sun, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Map of icon names to Lucide components
const IconMap = {
  moon: Moon,
  moonplus: MoonStar,
  moonstar: MoonStar,
  star: Star,
  sun: Sun, // Using MoonStar for moonplus as it's the closest match
};

type IconName = keyof typeof IconMap;

export default function Banner() {
  const [isVisible, setIsVisible] = useState(true);

  // Check if banner should be shown based on environment variable
  const shouldShowBanner =
    process.env.NEXT_PUBLIC_SHOW_BANNER?.toLowerCase() === "true";

  if (!isVisible || !shouldShowBanner) {
    return null;
  }

  const iconName = (
    process.env.NEXT_PUBLIC_BANNER_LOGO || "moonplus"
  ).toLowerCase() as IconName;
  const bannerLink = process.env.NEXT_PUBLIC_BANNER_LINK || "/";
  const bannerText = process.env.NEXT_PUBLIC_BANNER_TEXT || "Meet Alora";

  const IconComponent = IconMap[iconName] || MoonStar;

  return (
    <div
      className="relative z-50 flex items-center justify-between w-full h-[40px] px-4 border-b border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
      id="marketing-banner"
    >
      <div className="flex items-center justify-center flex-1 md:flex-initial md:mr-4">
        <div className="flex items-center gap-3">
          <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <Link
            className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
            href={bannerLink}
          >
            {bannerText}
          </Link>
        </div>
      </div>
      <div className="flex items-center">
        <button
          className="flex justify-center items-center text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 dark:hover:bg-gray-600 dark:hover:text-white"
          onClick={() => setIsVisible(false)}
          type="button"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close banner</span>
        </button>
      </div>
    </div>
  );
}
