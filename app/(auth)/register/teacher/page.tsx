import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function TeacherRegisterPage() {
  const dict = getDictionary();

  return (
    <AuthShell brand={dict.brand} auth={dict.auth}>
      <div className="w-full max-w-xl">
        <RegisterForm auth={dict.auth} kind="teacher" />
      </div>
    </AuthShell>
  );
}

