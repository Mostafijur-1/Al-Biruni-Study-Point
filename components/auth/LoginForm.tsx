"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/lib/i18n";
import { getLocalizedPath } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { loginSchema, type LoginInput } from "@/lib/validations/auth.schema";

type ApiResponse = {
  success: boolean;
  data?: {
    user: { role: "admin" | "teacher" | "student" };
  };
  error?: { message: string };
};

type LoginFormProps = {
  locale: Locale;
  auth: Dictionary["auth"];
};

export function LoginForm({ locale, auth }: LoginFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setMessage(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as ApiResponse;

    if (!response.ok || !payload.success || !payload.data) {
      setMessage(payload.error?.message || "Login failed.");
      return;
    }

    window.dispatchEvent(new Event("absp-auth-changed"));
    router.push(`/${locale}/${payload.data.user.role}`);
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
        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <Button type="submit" form="login-form" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? auth.login.submitting : auth.login.submit}
        </Button>
        <p className="text-center text-sm text-muted">
          {auth.login.noAccount}{" "}
          <Link href={getLocalizedPath("/register", locale)} className="font-semibold text-primary hover:underline">
            {auth.login.registerLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
