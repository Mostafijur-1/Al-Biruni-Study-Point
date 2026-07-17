import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

const publicRoutes = ["", "/about", "/batches", "/contact", "/courses", "/faq"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((path) => ({
    url: `${siteOrigin}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/courses" ? 0.9 : 0.7,
  }));
}

