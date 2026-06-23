import { BatchesList } from "@/components/batches/BatchesList";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function BatchesPage() {
  const dict = getDictionary();

  return <BatchesList dict={dict.home.batches} />;
}

