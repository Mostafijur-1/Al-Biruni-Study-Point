import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const dict = getDictionary();

  return (
    <AuthShell brand={dict.brand} auth={dict.auth}>
      <LoginForm auth={dict.auth} returnUrl={next ?? null} reason={reason ?? null} />
    </AuthShell>
  );
}

