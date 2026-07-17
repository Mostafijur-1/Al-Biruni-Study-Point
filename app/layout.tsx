import type { Metadata, Viewport } from "next";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { siteOrigin, siteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "ABSP - Al-Biruni Study Point",
    template: "%s | ABSP",
  },
  description:
    "Science coaching center(offline/online) and LMS for SSC and HSC students.",
  applicationName: "Al-Biruni Study Point",
  keywords: ["ABSP", "Al-Biruni Study Point", "SSC coaching", "HSC coaching", "Bangladesh LMS"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: "/",
    siteName: "Al-Biruni Study Point",
    title: "ABSP - Al-Biruni Study Point",
    description: "Science coaching and learning support for SSC and HSC students.",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "ABSP" }],
  },
  twitter: {
    card: "summary",
    title: "ABSP - Al-Biruni Study Point",
    description: "Science coaching and learning support for SSC and HSC students.",
    images: ["/icon.png"],
  },
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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        name: "Al-Biruni Study Point",
        alternateName: "ABSP",
        url: siteOrigin,
        logo: `${siteOrigin}/icon.png`,
        description: "Science coaching and learning support for SSC and HSC students.",
      },
      {
        "@type": "WebSite",
        name: "Al-Biruni Study Point",
        url: siteOrigin,
        inLanguage: "bn-BD",
      },
    ],
  };

  return (
    <html lang="bn" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground transition-colors duration-200">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-white px-4 py-2 font-semibold text-primary shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-brand-yellow"
        >
          মূল কনটেন্টে যান
        </a>
        <div className="flex min-h-screen flex-col">
          <Navbar navigation={dict.navigation} auth={dict.auth} />
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
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

