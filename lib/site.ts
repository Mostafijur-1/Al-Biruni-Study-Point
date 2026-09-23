const fallbackSiteUrl = "https://abspoint.top";

function resolveSiteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || fallbackSiteUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export const siteUrl = resolveSiteUrl();
export const siteOrigin = siteUrl.origin;

export const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61590844076118";

