import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/layout/AuthShell";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type RegisterPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return (
    <AuthShell locale={locale} brand={dict.brand} auth={dict.auth}>
      <div className="w-full max-w-xl">
        <RegisterForm locale={locale} auth={dict.auth} />
      </div>
    </AuthShell>
  );
}
