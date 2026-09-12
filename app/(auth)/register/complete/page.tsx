import { StudentOnboardingForm } from "@/components/auth/StudentOnboardingForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { getSafeReturnUrl } from "@/lib/auth/return-url";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function CompleteRegistrationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dict = getDictionary();
  return <AuthShell brand={dict.brand} auth={dict.auth}><div className="w-full max-w-lg"><StudentOnboardingForm returnUrl={getSafeReturnUrl(next)} /></div></AuthShell>;
}
