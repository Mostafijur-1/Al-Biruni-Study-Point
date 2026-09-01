import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance/FinanceWorkspace";

export const metadata: Metadata = { title: "Finance Management | ABSP" };

export default function AdminFinancePage() { return <FinanceWorkspace />; }
