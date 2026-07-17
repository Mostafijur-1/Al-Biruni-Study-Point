import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin/", "/student/", "/teacher/", "/api/", "/login", "/register"],
      },
    ],
    sitemap: `${siteOrigin}/sitemap.xml`,
    host: siteOrigin,
  };
}

