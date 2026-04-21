import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "span — Swap, Bridge, Transfer",
  description: "Build with Arc App Kit: swap, bridge, and transfer tokens across chains.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
