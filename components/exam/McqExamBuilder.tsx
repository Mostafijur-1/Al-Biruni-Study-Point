"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { createLocalizedPath, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { createMcqExamSchema, type CreateMcqExamFormInput } from "@/lib/validations/mcq.schema";
import { cn } from "@/lib/utils";
import type { McqExamDetailTeacher, McqQuestionTeacher } from "@/types/mcq";

type McqExamBuilderProps = {
  locale: Locale;
  examId?: string;
};

const emptyQuestion = {
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  marks: 1,
  difficulty: "medium" as const,
};

function mapQuestions(questions: McqQuestionTeacher[]) {
  return questions.map((q) => ({
    question: q.question,
    questionBn: q.questionBn || "",
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation || "",
    marks: q.marks,
    difficulty: q.difficulty,
    topic: q.topic || "",
  }));
}

export function McqExamBuilder({ locale, examId }: McqExamBuilderProps) {
  const path = createLocalizedPath(locale);
  const isEdit = Boolean(examId);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMcqExamFormInput>({
    resolver: zodResolver(createMcqExamSchema),
    defaultValues: {
      title: "",
      duration: 30,
      passMark: 5,
      negativeMarking: 0,
      attempts: 1,
      isRandomized: false,
      isPublished: false,
      questions: [emptyQuestion],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "questions" });

  useEffect(() => {
    if (!examId) {
      return;
    }

    let active = true;

    async function loadExam() {
      const { ok, payload } = await apiFetch<{
        exam: McqExamDetailTeacher;
        questions: McqQuestionTeacher[];
      }>(`/api/mcq/exams/${examId}`);

      if (!active) {
        return;
      }

      if (!ok || !isApiSuccess(payload)) {
        setMessage(getApiErrorMessage(payload, "Could not load exam."));
        setLoading(false);
        return;
      }

      const { exam, questions } = payload.data;

      reset({
        title: exam.title,
        duration: exam.duration,
        passMark: exam.passMark,
        negativeMarking: exam.negativeMarking ?? 0,
        attempts: exam.attempts,
        isRandomized: exam.isRandomized,
        isPublished: exam.isPublished,
        questions: mapQuestions(questions),
      });

      setLoading(false);
    }

    loadExam().catch(() => {
      setMessage("Could not load exam.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [examId, reset]);

  async function onSubmit(values: CreateMcqExamFormInput) {
    setMessage(null);
    const url = isEdit ? `/api/mcq/exams/${examId}` : "/api/mcq/exams";
    const method = isEdit ? "PATCH" : "POST";

    const { ok, payload } = await apiFetch<{ exam: { title: string } }>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!ok || !isApiSuccess(payload)) {
      setMessage(getApiErrorMessage(payload, `Could not ${isEdit ? "update" : "create"} exam.`));
      return;
    }

    const title = payload.data.exam.title ?? values.title;
    setMessage(isEdit ? `Exam updated: ${title}` : `Exam created: ${title}`);

    if (!isEdit) {
      reset({
        title: "",
        duration: 30,
        passMark: 5,
        negativeMarking: 0,
        attempts: 1,
        isRandomized: false,
        isPublished: false,
        questions: [emptyQuestion],
      });
    }
  }

  if (loading) {
    return <p className="rounded-xl border border-border bg-card p-6 text-muted">Loading exam...</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={path("/teacher/mcq")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to MCQ exams
        </Link>
        {isEdit && examId && (
          <Link
            href={path(`/teacher/mcq/${examId}/results`)}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-semibold text-primary"
          >
            View student results
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Teacher panel</p>
        <h1 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
          {isEdit ? "Edit MCQ Exam" : "Create MCQ Exam"}
        </h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-3">
            <span className="text-sm font-semibold">Title</span>
            <input {...register("title")} className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3" />
            {errors.title && <span className="mt-1 block text-sm text-destructive">{errors.title.message}</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Duration (minutes)</span>
            <input
              type="number"
              {...register("duration", { valueAsNumber: true })}
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Pass mark</span>
            <input
              type="number"
              {...register("passMark", { valueAsNumber: true })}
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Max attempts</span>
            <input
              type="number"
              {...register("attempts", { valueAsNumber: true })}
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-3">
            <input type="checkbox" {...register("isRandomized")} />
            <span className="text-sm font-semibold">Randomize questions</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-3">
            <input type="checkbox" {...register("isPublished")} />
            <span className="text-sm font-semibold">Published (visible to students)</span>
          </label>
        </div>
      </div>

      {fields.map((field, questionIndex) => (
        <fieldset key={field.id} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-4">
            <legend className="font-display text-lg font-bold text-primary">Question {questionIndex + 1}</legend>
            {fields.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => remove(questionIndex)}
                className="text-muted hover:text-brand-red"
              >
                Remove
              </Button>
            )}
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Question</span>
            <textarea
              {...register(`questions.${questionIndex}.question`)}
              className="mt-2 min-h-24 w-full rounded-lg border border-input bg-surface px-3 py-3"
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((optionIndex) => (
              <label key={optionIndex} className="block">
                <span className="text-sm font-semibold">Option {optionIndex + 1}</span>
                <input
                  {...register(`questions.${questionIndex}.options.${optionIndex}`)}
                  className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold">Correct option</span>
              <select
                {...register(`questions.${questionIndex}.correctIndex`, { valueAsNumber: true })}
                className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
              >
                <option value={0}>Option 1</option>
                <option value={1}>Option 2</option>
                <option value={2}>Option 3</option>
                <option value={3}>Option 4</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Marks</span>
              <input
                type="number"
                {...register(`questions.${questionIndex}.marks`, { valueAsNumber: true })}
                className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Difficulty</span>
              <select
                {...register(`questions.${questionIndex}.difficulty`)}
                className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Explanation (shown after submit)</span>
            <textarea
              {...register(`questions.${questionIndex}.explanation`)}
              className="mt-2 min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-3"
            />
          </label>
        </fieldset>
      ))}

      {message && (
        <p
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            message.includes("created") || message.includes("updated")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-border bg-card text-muted",
          )}
        >
          {message}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => append(emptyQuestion)}>
          Add question
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Update exam" : "Save exam"}
        </Button>
      </div>
    </form>
  );
}
