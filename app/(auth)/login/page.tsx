import { cookies } from "next/headers";

import { AlreadyLoggedInCard } from "@/components/auth/AlreadyLoggedInCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const dict = getDictionary();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let hasAuthenticatedSession = false;

  try {
    if (accessToken) {
      verifyAccessToken(accessToken);
      hasAuthenticatedSession = true;
    } else if (refreshToken) {
      verifyRefreshToken(refreshToken);
      hasAuthenticatedSession = true;
    }
  } catch {
    if (refreshToken) {
      try {
        verifyRefreshToken(refreshToken);
        hasAuthenticatedSession = true;
      } catch {
        hasAuthenticatedSession = false;
      }
    }
  }

  return (
    <AuthShell brand={dict.brand} auth={dict.auth}>
      {hasAuthenticatedSession ? (
        <AlreadyLoggedInCard auth={dict.auth} />
      ) : (
        <LoginForm auth={dict.auth} returnUrl={next ?? null} reason={reason ?? null} />
      )}
    </AuthShell>
  );
}
