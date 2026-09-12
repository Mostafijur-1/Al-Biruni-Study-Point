"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { buildRegisterUrl } from "@/lib/auth/return-url";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { loginSchema, type LoginInput } from "@/lib/validations/auth.schema";
import type { SessionUser } from "@/types";

type LoginFormProps = {
    auth: Dictionary["auth"];
  returnUrl?: string | null;
  reason?: string | null;
  googleError?: string | null;
};

export function LoginForm({ auth, returnUrl, reason, googleError }: LoginFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", returnUrl: returnUrl ?? "" },
  });

  async function onSubmit(values: LoginInput) {
    setMessage(null);
    const { ok, payload } = await apiFetch<{ user: SessionUser; redirectTo: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: values.identifier,
        password: values.password,
        returnUrl: returnUrl || values.returnUrl || undefined,
      }),
    });

    if (!ok || !isApiSuccess(payload)) {
      setMessage(getApiErrorMessage(payload, "Login failed."));
      return;
    }

    window.dispatchEvent(new Event("absp-auth-changed"));
    router.push(payload.data.redirectTo);
    router.refresh();
  }

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{auth.login.title}</p>
        <CardTitle className="mt-1">{auth.login.title}</CardTitle>
        <CardDescription>{auth.login.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthReturnNotice reason={reason} copy={auth.guestAccess} />
        {googleError && <Alert variant="destructive" className="mb-4">{googleError}</Alert>}
        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full border-primary/30 bg-white text-foreground hover:bg-secondary/30 dark:bg-card"
          onClick={() => {
            const params = new URLSearchParams({ flow: "login" });
            if (returnUrl) params.set("next", returnUrl);
            window.location.assign(`/api/auth/google?${params.toString()}`);
          }}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white text-base font-black text-[#4285F4] shadow-sm">G</span>
          Login with Google
        </Button>
        <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
          <span className="h-px flex-1 bg-border" />or login with password<span className="h-px flex-1 bg-border" />
        </div>
        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("returnUrl")} />
          <div className="space-y-2">
            <Label htmlFor="identifier">{auth.login.identifier}</Label>
            <Input
              id="identifier"
              {...register("identifier")}
              placeholder="016339****2"
              autoComplete="username"
            />
            {errors.identifier && (
              <p className="text-sm text-destructive">{errors.identifier.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{auth.login.password}</Label>
            <Input id="password" type="password" {...register("password")} autoComplete="current-password" />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          {message && <Alert variant="destructive">{message}</Alert>}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" form="login-form" className="w-full" loading={isSubmitting}>
          {isSubmitting ? auth.login.submitting : auth.login.submit}
        </Button>
        <p className="text-center text-sm text-muted">
          {auth.login.noAccount}{" "}
          <Link
            href={buildRegisterUrl(returnUrl ?? undefined)}
            className="font-semibold text-primary hover:underline"
          >
            {auth.login.registerLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
