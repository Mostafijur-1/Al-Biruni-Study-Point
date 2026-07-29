"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type AlreadyLoggedInCardProps = {
  auth: Dictionary["auth"];
};

export function AlreadyLoggedInCard({ auth }: AlreadyLoggedInCardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logoutAndReturnToLogin() {
    setIsLoggingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError(auth.login.logoutFailed);
        return;
      }

      window.dispatchEvent(new Event("absp-auth-changed"));
      router.replace("/login");
      router.refresh();
    } catch {
      setError(auth.login.logoutFailed);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {auth.login.alreadyLoggedInEyebrow}
        </p>
        <CardTitle className="mt-1">{auth.login.alreadyLoggedInTitle}</CardTitle>
        <CardDescription>{auth.login.alreadyLoggedInBody}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive">{error}</Alert>}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          className="w-full"
          loading={isLoggingOut}
          onClick={logoutAndReturnToLogin}
        >
          <LogOut className="size-4" />
          {isLoggingOut ? auth.login.loggingOut : auth.login.logoutAndLogin}
        </Button>
      </CardFooter>
    </Card>
  );
}
