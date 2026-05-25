import { McqExamRunner } from "@/components/exam/McqExamRunner";

type StudentExamAttemptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentExamAttemptPage({
  params,
}: StudentExamAttemptPageProps) {
  const { id } = await params;

  return <McqExamRunner examId={id} />;
}
