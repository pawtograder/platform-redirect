import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pawtograder — choose your school",
  description: "Pawtograder is now hosted by each school. Choose yours to continue.",
  // This origin only ever serves a redirect interstitial; keeping it out of
  // search results stops it from outranking the schools' real deployments.
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
