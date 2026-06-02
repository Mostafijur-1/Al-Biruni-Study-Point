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
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { loginSchema, type LoginInput } from "@/lib/validations/auth.schema";
import type { SessionUser } from "@/types";

type LoginFormProps = {
  locale: Locale;
  auth: Dictionary["auth"];
  returnUrl?: string | null;
  reason?: string | null;
};

export function LoginForm({ locale, auth, returnUrl, reason }: LoginFormProps) {
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
        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("returnUrl")} />
          <div className="space-y-2">
            <Label htmlFor="identifier">{auth.login.identifier}</Label>
            <Input
              id="identifier"
              {...register("identifier")}
              placeholder="01XXXXXXXXX"
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
            href={buildRegisterUrl(locale, returnUrl ?? undefined)}
            className="font-semibold text-primary hover:underline"
          >
            {auth.login.registerLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
