import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LoginPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return (
    <AuthShell locale={locale} brand={dict.brand} auth={dict.auth}>
      <LoginForm locale={locale} auth={dict.auth} />
    </AuthShell>
  );
}
