"use client";

import Image from "next/image";
import Link from "next/link";
import ClientHeader from "./ClientHeader";
import { usePathname } from "next/navigation";
import NavMenu from "./NavMenu";
import MobileMenu from "@/components/ui/MobileMenu";

export default function Header({ nickname }: { nickname?: string }) {
  const pathname = usePathname();
  const isResultsPage = pathname === "/results";
  const isProjectsPage = pathname === "/labs/projects";

  return (
    <ClientHeader nickname={nickname}>
      <nav className="sticky top-0 z-[100] border-b border-gray-700 bg-gray-900">
        <div
          className={`mx-auto flex flex-nowrap items-center justify-between p-4 ${isProjectsPage ? "" : "max-w-screen-xl"}`}
        >
          <div className="flex items-center shrink-0">
            <Link
              className="flex items-center"
              href={process.env.NEXT_PUBLIC_APP_BASE_URL || "/"}
            >
              <Image
                alt="Sleep Architects Logo"
                className="max-w-none"
                height={40}
                priority
                src="/images/logos/SA-logo-full_all-white.svg"
                style={{ display: "block", height: "auto" }}
                width={180}
              />
            </Link>
          </div>

          {!isResultsPage && (
            <>
              <div className="hidden w-full lg:flex lg:flex-1 lg:justify-center lg:-ml-6">
                <NavMenu />
              </div>

              <div className="lg:hidden">
                <MobileMenu />
              </div>
            </>
          )}
        </div>
      </nav>
    </ClientHeader>
  );
}
