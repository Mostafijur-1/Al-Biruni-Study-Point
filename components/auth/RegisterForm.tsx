"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/lib/i18n";
import { getLocalizedPath } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { registerSchema, type RegisterFormInput } from "@/lib/validations/auth.schema";

type RegisterResponse = {
  success: boolean;
  data?: { message: string };
  error?: { message: string };
};

type RegisterFormProps = {
  locale: Locale;
  auth: Dictionary["auth"];
};

export function RegisterForm({ locale, auth }: RegisterFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      role: "student",
      studentClass: "class-9",
    },
  });
  const selectedRole = useWatch({ control, name: "role" });

  async function onSubmit(values: RegisterFormInput) {
    setMessage(null);
    setIsSuccess(false);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as RegisterResponse;

    setMessage(payload.data?.message || payload.error?.message || "Registration failed.");
    setIsSuccess(response.ok && payload.success);
  }

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{auth.register.title}</p>
        <CardTitle className="mt-1">{auth.register.title}</CardTitle>
        <CardDescription>{auth.register.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="register-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{auth.register.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">
              {auth.register.phone}
              {selectedRole === "teacher" ? ` (${locale === "bn" ? "ঐচ্ছিক" : "optional"})` : ""}
            </Label>
            <Input id="phone" {...register("phone")} placeholder="01XXXXXXXXX" />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              {auth.register.email}
              {selectedRole === "teacher" ? "" : ` (${locale === "bn" ? "ঐচ্ছিক" : "optional"})`}
            </Label>
            <Input id="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{auth.register.password}</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{auth.register.role}</Label>
            <select
              id="role"
              {...register("role")}
              className="flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="student">{auth.register.roles.student}</option>
              <option value="teacher">{auth.register.roles.teacher}</option>
            </select>
          </div>
          {selectedRole === "student" && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="studentClass">{auth.register.studentClass}</Label>
              <select
                id="studentClass"
                {...register("studentClass")}
                className="flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="class-9">{auth.register.classes["class-9"]}</option>
                <option value="class-10">{auth.register.classes["class-10"]}</option>
                <option value="class-11">{auth.register.classes["class-11"]}</option>
                <option value="class-12">{auth.register.classes["class-12"]}</option>
              </select>
              {errors.studentClass && (
                <p className="text-sm text-destructive">{errors.studentClass.message}</p>
              )}
            </div>
          )}
          {message && (
            <div className="sm:col-span-2">
              <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" form="register-form" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? auth.register.submitting : auth.register.submit}
        </Button>
        {isSuccess ? (
          <Link
            href={getLocalizedPath("/login", locale)}
            className="text-center text-sm font-semibold text-primary hover:underline"
          >
            {auth.register.continueLogin}
          </Link>
        ) : (
          <p className="text-center text-sm text-muted">
            {auth.register.hasAccount}{" "}
            <Link href={getLocalizedPath("/login", locale)} className="font-semibold text-primary hover:underline">
              {auth.register.loginLink}
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
