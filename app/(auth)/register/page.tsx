import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { getDictionary } from "@/lib/i18n/get-dictionary";

function classFromReturnUrl(returnUrl?: string | null) {
  if (!returnUrl?.includes("?")) {
    return null;
  }

  const query = returnUrl.split("?")[1];
  return query ? new URLSearchParams(query).get("class") : null;
}

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function StudentRegisterPage({ searchParams }: RegisterPageProps) {
  const { next, reason } = await searchParams;
  const dict = getDictionary();

  return (
    <AuthShell brand={dict.brand} auth={dict.auth}>
      <div className="w-full max-w-xl">
        <RegisterForm
          auth={dict.auth}
          kind="student"
          returnUrl={next ?? null}
          reason={reason ?? null}
          initialClass={classFromReturnUrl(next)}
        />
      </div>
    </AuthShell>
  );
}

