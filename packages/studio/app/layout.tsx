import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/DashboardShell";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Contenz Studio",
  description: "Authoring studio for Contenz content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} min-h-screen font-sans antialiased`}>
        <TooltipProvider>
          <DashboardShell>{children}</DashboardShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
