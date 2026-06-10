import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ABSP - Al-Biruni Study Point",
    template: "%s | ABSP",
  },
  description:
    "Science coaching center(offline/online) and LMS for SSC and HSC students.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260603b", sizes: "any" },
      { url: "/icon.png?v=20260603b", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png?v=20260603b", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.ico?v=20260603b",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
