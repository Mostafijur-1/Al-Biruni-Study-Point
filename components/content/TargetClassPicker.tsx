"use client";

import { STUDENT_CLASSES, getClassLabel } from "@/lib/content/classes";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StudentClass } from "@/types";

type TargetClassPickerProps = {
    value: StudentClass[];
  onChange: (classes: StudentClass[]) => void;
  error?: string;
  label?: string;
  hint?: string;
};

export function TargetClassPicker({ value,
  onChange,
  error,
  label,
  hint,
}: TargetClassPickerProps) {
  const locale = "bn";
      const selectedClasses = value ?? [];

  function toggle(studentClass: StudentClass) {
    if (selectedClasses.includes(studentClass)) {
      onChange(selectedClasses.filter((item) => item !== studentClass));
      return;
    }

    onChange([...selectedClasses, studentClass]);
  }

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-semibold">{label}</span>}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STUDENT_CLASSES.map((studentClass) => {
          const selected = selectedClasses.includes(studentClass);

          return (
            <label
              key={studentClass}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted hover:border-primary/40",
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={selected}
                onChange={() => toggle(studentClass)}
              />
              {getClassLabel(studentClass, locale)}
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
