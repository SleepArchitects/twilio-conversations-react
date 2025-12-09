"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Avatar,
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from "flowbite-react";
import ShowIfAuthenticated from "../auth/showIfAuthenticated";
import { customDropdownTheme, customAvatarTheme } from "@/lib/flowbite-theme";

export default function UserDropdown({
  user,
  nickname,
  profileImageUrl,
}: {
  // Auth0 user object - can be null/undefined from useUser()
  user?: {
    email?: string;
    id?: string;
    name?: string;
    image?: string;
  } | null;
  nickname?: string;
  profileImageUrl?: string | null;
}) {
  // Track the currently displayed image to prevent flashing during loads
  const [displayedImage, setDisplayedImage] = useState<string | undefined>(
    undefined,
  );
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Preload the profile image before displaying it
  useEffect(() => {
    const imageToLoad = profileImageUrl || user?.image;

    if (!imageToLoad) {
      setDisplayedImage(undefined);
      setIsImageLoaded(false);
      return;
    }

    // If the image is already displayed, don't reload it
    if (displayedImage === imageToLoad && isImageLoaded) {
      return;
    }

    // Preload the image
    const img = new Image();
    img.onload = () => {
      setDisplayedImage(imageToLoad);
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      // If image fails to load, fall back to showing nothing (will show initials)
      setDisplayedImage(undefined);
      setIsImageLoaded(false);
    };
    img.src = imageToLoad;
  }, [profileImageUrl, user?.image, displayedImage, isImageLoaded]);

  const handleSignOut = async () => {
    console.log("[LOGOUT DEBUG] Current user session:", user);

    try {
      console.debug(`[LOGOUT DEBUG] Attempting logout for user: ${user?.id}`);

      window.location.href = "/auth/logout";
    } catch {
      // Fallback to regular logout on error
      window.location.href = "/auth/logout";
    }
  };

  const displayName = user?.name || nickname || "User";
  const userInitials = displayName.charAt(0).toUpperCase();
  const userEmail = user?.email || "";

  return (
    <div>
      <Dropdown
        arrowIcon={false}
        inline
        theme={customDropdownTheme}
        label={
          <Avatar
            className="cursor-pointer"
            img={displayedImage}
            placeholderInitials={userInitials}
            rounded
            status="online"
            statusPosition="bottom-right"
            theme={customAvatarTheme}
          />
        }
      >
        <ShowIfAuthenticated>
          <DropdownHeader>
            <div className="min-w-[200px]">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                {userEmail}
              </span>
            </div>
          </DropdownHeader>
          <Link href="/profile">
            <DropdownItem>Profile</DropdownItem>
          </Link>
          {/* <DropdownItem as={Link} href="/settings">
            Settings
          </DropdownItem> */}
          <DropdownDivider />
          <DropdownItem onClick={handleSignOut}>Sign out</DropdownItem>
        </ShowIfAuthenticated>
      </Dropdown>
    </div>
  );
}
