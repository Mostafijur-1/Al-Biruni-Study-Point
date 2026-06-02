import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LoginPageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const { next, reason } = await searchParams;
  const dict = getDictionary(locale);

  return (
    <AuthShell locale={locale} brand={dict.brand} auth={dict.auth}>
      <LoginForm locale={locale} auth={dict.auth} returnUrl={next ?? null} reason={reason ?? null} />
    </AuthShell>
  );
}
