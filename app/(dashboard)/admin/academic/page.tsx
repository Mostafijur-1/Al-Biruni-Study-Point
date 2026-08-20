import { BatchSubjectSetupPanel } from "@/components/coaching/BatchSubjectSetupPanel";
import { AdminBatchManager } from "@/components/batches/AdminBatchManager";

export default function AdminAcademicPage() {
  return <div className="space-y-10"><AdminBatchManager /><div className="border-t border-border pt-8"><BatchSubjectSetupPanel /></div></div>;
}
