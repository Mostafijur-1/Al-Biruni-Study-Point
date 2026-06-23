import type { Metadata, Viewport } from "next";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";

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
  appleWebApp: {
    capable: true,
    title: "ABSP",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2545",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dict = getDictionary();

  return (
    <html lang="bn" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground transition-colors duration-200">
        <div className="flex min-h-screen flex-col">
          <Navbar navigation={dict.navigation} auth={dict.auth} />
          <main className="flex-1">{children}</main>
          <Footer
            brand={dict.brand}
            footer={dict.footer}
            navigation={dict.navigation}
            contact={dict.contact}
          />
        </div>
        <PwaInstallPrompt />
      </body>
    </html>
  );
}

