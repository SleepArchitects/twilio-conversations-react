import type { Metadata } from "next";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMS Outreach | SleepConnect",
  description: "Patient SMS communication management",
};

// Check if auth is disabled (for development)
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // When auth is disabled, don't wrap with UserProvider to avoid /api/auth/me calls
  const content = (
    <Providers>
      {children}
      <Toaster position="top-right" richColors closeButton theme="dark" />
    </Providers>
  );

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('color-theme') === 'light' ||
                    (!localStorage.getItem('color-theme') && 
                     window.matchMedia('(prefers-color-scheme: light)').matches)) {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-900`}>
        {isAuthDisabled ? content : <UserProvider>{content}</UserProvider>}
      </body>
    </html>
  );
}
