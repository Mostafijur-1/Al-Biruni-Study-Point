"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { createMcqExamSchema, type CreateMcqExamFormInput } from "@/lib/validations/mcq.schema";

type CreateExamResponse = {
  success: boolean;
  data?: { exam: { _id: string; title: string } };
  error?: { message: string };
};

export function McqExamBuilder() {
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
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
      questions: [
        {
          question: "",
          options: ["", "", "", ""],
          correctIndex: 0,
          marks: 1,
          difficulty: "medium",
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "questions" });

  async function onSubmit(values: CreateMcqExamFormInput) {
    setMessage(null);
    const response = await fetch("/api/mcq/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as CreateExamResponse;

    if (!response.ok || !payload.success) {
      setMessage(payload.error?.message || "Could not create exam.");
      return;
    }

    setMessage(`Exam created: ${payload.data?.exam.title}`);
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="rounded border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Teacher panel</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Create MCQ Exam</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-3">
            <span className="text-sm font-semibold">Title</span>
            <input {...register("title")} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
            {errors.title && <span className="text-sm text-red-600">{errors.title.message}</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Duration</span>
            <input type="number" {...register("duration", { valueAsNumber: true })} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Pass mark</span>
            <input type="number" {...register("passMark", { valueAsNumber: true })} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Attempts</span>
            <input type="number" {...register("attempts", { valueAsNumber: true })} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("isRandomized")} />
            <span className="text-sm font-semibold">Randomize questions</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("isPublished")} />
            <span className="text-sm font-semibold">Publish now</span>
          </label>
        </div>
      </div>

      {fields.map((field, questionIndex) => (
        <fieldset key={field.id} className="rounded border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <legend className="text-lg font-bold text-primary">Question {questionIndex + 1}</legend>
            {fields.length > 1 && (
              <button type="button" onClick={() => remove(questionIndex)} className="rounded border border-border px-3 py-1 text-sm font-semibold text-muted">
                Remove
              </button>
            )}
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Question</span>
            <textarea {...register(`questions.${questionIndex}.question`)} className="mt-2 min-h-24 w-full rounded border border-border bg-background px-3 py-3" />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((optionIndex) => (
              <label key={optionIndex} className="block">
                <span className="text-sm font-semibold">Option {optionIndex + 1}</span>
                <input {...register(`questions.${questionIndex}.options.${optionIndex}`)} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold">Correct option</span>
              <select {...register(`questions.${questionIndex}.correctIndex`, { valueAsNumber: true })} className="mt-2 w-full rounded border border-border bg-background px-3 py-3">
                <option value={0}>Option 1</option>
                <option value={1}>Option 2</option>
                <option value={2}>Option 3</option>
                <option value={3}>Option 4</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Marks</span>
              <input type="number" {...register(`questions.${questionIndex}.marks`, { valueAsNumber: true })} className="mt-2 w-full rounded border border-border bg-background px-3 py-3" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Difficulty</span>
              <select {...register(`questions.${questionIndex}.difficulty`)} className="mt-2 w-full rounded border border-border bg-background px-3 py-3">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Explanation</span>
            <textarea {...register(`questions.${questionIndex}.explanation`)} className="mt-2 min-h-20 w-full rounded border border-border bg-background px-3 py-3" />
          </label>
        </fieldset>
      ))}

      {message && <p className="rounded border border-border bg-surface px-3 py-2 text-sm text-muted">{message}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            append({
              question: "",
              options: ["", "", "", ""],
              correctIndex: 0,
              marks: 1,
              difficulty: "medium",
            })
          }
          className="rounded border border-border bg-surface px-4 py-3 font-semibold text-primary"
        >
          Add Question
        </button>
        <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {isSubmitting ? "Saving..." : "Save Exam"}
        </button>
      </div>
    </form>
  );
}
