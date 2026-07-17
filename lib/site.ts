const fallbackSiteUrl = "https://absp.vercel.app";

function resolveSiteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || fallbackSiteUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export const siteUrl = resolveSiteUrl();
export const siteOrigin = siteUrl.origin;

