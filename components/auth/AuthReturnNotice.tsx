"use client";

import { Alert } from "@/components/ui/alert";
type AuthReturnNoticeProps = {
  reason?: string | null;
  copy: {
    accessTitle: string;
    accessBody: string;
  };
};

export function AuthReturnNotice({ reason, copy }: AuthReturnNoticeProps) {
  if (reason !== "access") {
    return null;
  }

  return (
    <Alert variant="default" className="mb-4">
      <p className="font-semibold text-primary">{copy.accessTitle}</p>
      <p className="mt-1 text-sm text-muted">{copy.accessBody}</p>
    </Alert>
  );
}
