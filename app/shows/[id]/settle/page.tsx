import { redirect } from "next/navigation";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/shows/${id}#settlement`);
}
