import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ABSP - Al-Biruni Study Point",
    template: "%s | ABSP",
  },
  description:
    "Premium Bangladeshi science coaching center and LMS for SSC and HSC students.",
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
