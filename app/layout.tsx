import type { Metadata } from "next";
import { Hind_Siliguri, Noto_Sans_Bengali, Noto_Serif_Bengali, Playfair_Display } from "next/font/google";

import "./globals.css";

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  variable: "--font-sans-bn",
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-alt",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif-brand",
  display: "swap",
});

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["600", "700"],
  variable: "--font-serif-bn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ABSP - Al-Biruni Study Point",
    template: "%s | ABSP",
  },
  description:
    "Premium Bangladeshi science coaching center and LMS for SSC and HSC students.",
  icons: {
    icon: [{ url: "/absp-logo.png", type: "image/png" }],
    apple: [{ url: "/absp-logo.png", type: "image/png" }],
    shortcut: "/absp-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      className={`${notoSansBengali.variable} ${hindSiliguri.variable} ${playfair.variable} ${notoSerifBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
