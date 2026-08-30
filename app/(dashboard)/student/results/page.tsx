import { ResultHistory } from "@/components/exam/ResultHistory";
import { StudentWrittenResults } from "@/components/exam/StudentWrittenResults";

export default function StudentResultsPage() {
  return <div className="space-y-10"><StudentWrittenResults /><ResultHistory /></div>;
}
