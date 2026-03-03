"use client";

import { useState, lazy, Suspense } from "react";
import Link from "next/link";
import { Button } from "flowbite-react";
import { HiArrowLeft, HiTemplate, HiTag, HiExternalLink } from "react-icons/hi";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

// Lazy-load CategoryManager — heavier component with its own data-fetching
const CategoryManager = lazy(() =>
  import("@/components/templates/CategoryManager").then((mod) => ({
    default: mod.CategoryManager,
  })),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "sms-templates" | "template-categories";

interface TabItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: "sms-templates", label: "SMS Templates", icon: HiTemplate },
  { id: "template-categories", label: "Template Categories", icon: HiTag },
];

// ---------------------------------------------------------------------------
// Section loading skeleton
// ---------------------------------------------------------------------------

function SectionSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      role="status"
      aria-label="Loading section"
    >
      <div className="h-8 w-48 rounded bg-gray-700" />
      <div className="h-4 w-full rounded bg-gray-700" />
      <div className="h-4 w-5/6 rounded bg-gray-700" />
      <div className="h-4 w-4/6 rounded bg-gray-700" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMS Templates section — links to the dedicated templates page
// ---------------------------------------------------------------------------

function SmsTemplatesSection() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">SMS Templates</h2>
        <p className="mt-1 text-sm text-gray-400">
          Create and manage reusable SMS message templates. Assign categories to
          keep your templates organised.
        </p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <p className="mb-4 text-sm text-gray-300">
          Create, edit, duplicate, and delete templates from the dedicated
          Templates page.
        </p>
        <Link href="/outreach/templates">
          <Button color="blue">
            <HiExternalLink className="mr-2 h-4 w-4" />
            Open SMS Templates
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sms-templates");

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <PageHeader
        title="Settings"
        subtitle="Manage templates and categories"
        className="px-4"
      >
        <div className="flex items-center gap-4">
          <Link href="/conversations">
            <Button color="gray" size="sm">
              <HiArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab navigation */}
        <nav
          className="border-b border-gray-700 bg-gray-800 px-4"
          aria-label="Settings sections"
        >
          <ul className="-mb-px flex gap-0" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <li key={id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === id}
                  aria-controls={`tabpanel-${id}`}
                  id={`tab-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    activeTab === id
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab panels */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {/* SMS Templates panel */}
          <section
            id="tabpanel-sms-templates"
            role="tabpanel"
            aria-labelledby="tab-sms-templates"
            hidden={activeTab !== "sms-templates"}
          >
            {activeTab === "sms-templates" && <SmsTemplatesSection />}
          </section>

          {/* Template Categories panel */}
          <section
            id="tabpanel-template-categories"
            role="tabpanel"
            aria-labelledby="tab-template-categories"
            hidden={activeTab !== "template-categories"}
          >
            {activeTab === "template-categories" && (
              <Suspense fallback={<SectionSkeleton />}>
                <div className="mx-auto max-w-2xl">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-white">
                      Template Categories
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Create and manage categories used to organise SMS
                      templates. Categories currently in use by templates cannot
                      be deleted.
                    </p>
                  </div>
                  <CategoryManager />
                </div>
              </Suspense>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
