import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Banner from "@/components/layout/Banner";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMS Outreach | DreamConnect",
  description: "Patient SMS communication management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <Providers>
      <AuthGuard>
        <div className="flex min-h-screen flex-col">
          <Banner />
          <main className="flex-1 page-content">{children}</main>
          <Footer />
        </div>
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </AuthGuard>
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
        {content}
      </body>
    </html>
  );
}
