"use client";

import { Check, X } from "lucide-react";

import { pressableClasses } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"] as const;

type McqOptionProps = {
  label: string;
  optionText: string;
  isSelected: boolean;
  disabled?: boolean;
  resultMode?: "idle" | "correct" | "wrong" | "missed-correct" | "unchanged";
  onSelect: () => void;
};

export function McqOption({
  label,
  optionText,
  isSelected,
  disabled,
  resultMode = "idle",
  onSelect,
}: McqOptionProps) {
  const showResult = resultMode !== "idle";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3.5 text-left sm:px-4 sm:py-4",
        pressableClasses,
        "duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !showResult && !isSelected && "border-border bg-surface hover:border-primary/40 hover:bg-secondary/60",
        !showResult &&
          isSelected &&
          "border-primary bg-secondary shadow-[var(--shadow-sm)] ring-2 ring-primary/15",
        showResult && resultMode === "correct" && "border-emerald-500 bg-emerald-50",
        showResult && resultMode === "wrong" && "border-brand-red bg-red-50",
        showResult &&
          resultMode === "missed-correct" &&
          "border-emerald-400/80 bg-emerald-50/60",
        showResult && resultMode === "unchanged" && "border-border bg-surface opacity-70",
        disabled && !showResult && "cursor-default",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-all sm:size-10",
          !showResult && !isSelected && "border-border bg-background text-muted group-hover:border-primary/50 group-hover:text-primary",
          !showResult && isSelected && "border-primary bg-primary text-primary-foreground",
          showResult && resultMode === "correct" && "border-emerald-600 bg-emerald-600 text-white",
          showResult && resultMode === "wrong" && "border-brand-red bg-brand-red text-white",
          showResult && resultMode === "missed-correct" && "border-emerald-500 bg-emerald-500 text-white",
          showResult && resultMode === "unchanged" && "border-border bg-background text-muted",
        )}
      >
        {showResult && (resultMode === "correct" || resultMode === "missed-correct") ? (
          <Check className="size-5" strokeWidth={3} />
        ) : showResult && resultMode === "wrong" ? (
          <X className="size-5" strokeWidth={3} />
        ) : isSelected ? (
          <Check className="size-5" strokeWidth={3} />
        ) : (
          label
        )}
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 text-sm font-medium leading-snug sm:text-base",
          !showResult && isSelected && "text-primary",
          !showResult && !isSelected && "text-foreground",
          showResult && resultMode === "correct" && "text-emerald-900",
          showResult && resultMode === "wrong" && "text-red-900",
          showResult && resultMode === "missed-correct" && "text-emerald-800",
          showResult && resultMode === "unchanged" && "text-muted",
        )}
      >
        {optionText}
      </span>

      {!showResult && isSelected && (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary sm:text-xs">
          Selected
        </span>
      )}
      {showResult && resultMode === "correct" && (
        <span className="shrink-0 text-xs font-bold text-emerald-700">Correct</span>
      )}
      {showResult && resultMode === "wrong" && (
        <span className="shrink-0 text-xs font-bold text-brand-red">Your answer</span>
      )}
    </button>
  );
}

export function getOptionLabel(index: number) {
  return OPTION_LABELS[index] ?? String(index + 1);
}
