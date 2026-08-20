import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance/FinanceWorkspace";

export const metadata: Metadata = { title: "আর্থিক ব্যবস্থাপনা | ABSP" };

export default function AdminFinancePage() { return <FinanceWorkspace />; }
