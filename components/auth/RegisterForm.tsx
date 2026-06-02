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
import { AuthReturnNotice } from "@/components/auth/AuthReturnNotice";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { buildLoginUrl } from "@/lib/auth/return-url";
import { parseGuestClassParam } from "@/lib/content/guest-scope";
import type { Locale } from "@/lib/i18n";
import { getLocalizedPath } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  studentRegisterBodySchema,
  teacherRegisterSchema,
  type StudentRegisterFormInput,
  type TeacherRegisterFormInput,
} from "@/lib/validations/auth.schema";
import type { SessionUser } from "@/types";

type RegisterFormProps = {
  locale: Locale;
  auth: Dictionary["auth"];
  kind: "student" | "teacher";
  returnUrl?: string | null;
  reason?: string | null;
  initialClass?: string | null;
};

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function RegisterFooter({
  locale,
  auth,
  kind,
  isSubmitting,
  copy,
  returnUrl,
}: {
  locale: Locale;
  auth: Dictionary["auth"];
  kind: "student" | "teacher";
  isSubmitting: boolean;
  copy: Dictionary["auth"]["register"]["student"];
  returnUrl?: string | null;
}) {
  return (
    <CardFooter className="flex flex-col gap-4">
      <Button type="submit" form={`register-form-${kind}`} className="w-full" loading={isSubmitting}>
        {isSubmitting ? copy.submitting : copy.submit}
      </Button>
      <p className="text-center text-sm text-muted">
        {auth.register.hasAccount}{" "}
        <Link
          href={buildLoginUrl(locale, returnUrl ?? undefined)}
          className="font-semibold text-primary hover:underline"
        >
          {auth.register.loginLink}
        </Link>
      </p>
      <p className="text-center text-sm text-muted">
        {kind === "student" ? auth.register.teacherPrompt : auth.register.studentPrompt}{" "}
        <Link
          href={getLocalizedPath(kind === "student" ? "/register/teacher" : "/register", locale)}
          className="font-semibold text-primary hover:underline"
        >
          {kind === "student" ? auth.register.teacherLink : auth.register.studentLink}
        </Link>
      </p>
    </CardFooter>
  );
}

function StudentRegisterForm({
  locale,
  auth,
  returnUrl,
  reason,
  initialClass,
}: Omit<RegisterFormProps, "kind">) {
  const copy = auth.register.student;
  const optionalLabel = locale === "bn" ? "ঐচ্ছিক" : "optional";
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const defaultClass = parseGuestClassParam(initialClass ?? null) ?? "class-9";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentRegisterFormInput & { returnUrl?: string }>({
    resolver: zodResolver(studentRegisterBodySchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      studentClass: defaultClass,
      returnUrl: returnUrl ?? "",
    },
  });

  async function onSubmit(values: StudentRegisterFormInput & { returnUrl?: string }) {
    setMessage(null);

    const { ok, payload } = await apiFetch<{
      message: string;
      user: SessionUser;
      redirectTo: string;
    }>("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        returnUrl: returnUrl || values.returnUrl || undefined,
      }),
    });

    if (ok && isApiSuccess(payload)) {
      window.dispatchEvent(new Event("absp-auth-changed"));
      router.push(payload.data.redirectTo);
      router.refresh();
      return;
    }

    setMessage(getApiErrorMessage(payload, "Registration failed."));
  }

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{copy.eyebrow}</p>
        <CardTitle className="mt-1">{copy.title}</CardTitle>
        <CardDescription>{copy.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthReturnNotice reason={reason} copy={auth.guestAccess} />
        <form id="register-form-student" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" {...register("returnUrl")} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{auth.register.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{auth.register.phone}</Label>
            <Input id="phone" {...register("phone")} placeholder="01XXXXXXXXX" />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              {auth.register.email} ({optionalLabel})
            </Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="password">{auth.register.password}</Label>
            <Input id="password" type="password" {...register("password")} autoComplete="new-password" />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="studentClass">{auth.register.studentClass}</Label>
            <select id="studentClass" {...register("studentClass")} className={selectClassName}>
              <option value="class-9">{auth.register.classes["class-9"]}</option>
              <option value="class-10">{auth.register.classes["class-10"]}</option>
              <option value="class-11">{auth.register.classes["class-11"]}</option>
              <option value="class-12">{auth.register.classes["class-12"]}</option>
            </select>
            {errors.studentClass && (
              <p className="text-sm text-destructive">{errors.studentClass.message}</p>
            )}
          </div>
          {message && (
            <div className="sm:col-span-2">
              <Alert variant="destructive">{message}</Alert>
            </div>
          )}
        </form>
      </CardContent>
      <RegisterFooter
        locale={locale}
        auth={auth}
        kind="student"
        isSubmitting={isSubmitting}
        copy={copy}
        returnUrl={returnUrl}
      />
    </Card>
  );
}

function TeacherRegisterForm({ locale, auth }: Omit<RegisterFormProps, "kind">) {
  const copy = auth.register.teacher;
  
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeacherRegisterFormInput>({
    resolver: zodResolver(teacherRegisterSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: TeacherRegisterFormInput) {
    setMessage(null);
    setIsSuccess(false);

    const { ok, payload } = await apiFetch<{ message: string }>("/api/auth/register/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (ok && isApiSuccess(payload)) {
      setMessage(payload.data.message);
      setIsSuccess(true);
      return;
    }

    setMessage(getApiErrorMessage(payload, "Registration failed."));
    setIsSuccess(false);
  }

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{copy.eyebrow}</p>
        <CardTitle className="mt-1">{copy.title}</CardTitle>
        <CardDescription>{copy.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="register-form-teacher" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{auth.register.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{auth.register.phone}</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="01XXXXXXXXX"
              required
              autoComplete="tel"
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{auth.register.email}</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              required
              autoComplete="email"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="password">{auth.register.password}</Label>
            <Input id="password" type="password" {...register("password")} autoComplete="new-password" />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {message && (
            <div className="sm:col-span-2">
              <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert>
            </div>
          )}
        </form>
      </CardContent>
      <RegisterFooter
        locale={locale}
        auth={auth}
        kind="teacher"
        isSubmitting={isSubmitting}
        copy={copy}
      />
    </Card>
  );
}

export function RegisterForm({ locale, auth, kind, returnUrl, reason, initialClass }: RegisterFormProps) {
  if (kind === "teacher") {
    return <TeacherRegisterForm locale={locale} auth={auth} />;
  }

  return (
    <StudentRegisterForm
      locale={locale}
      auth={auth}
      returnUrl={returnUrl}
      reason={reason}
      initialClass={initialClass}
    />
  );
}
