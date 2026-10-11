
import { redirect } from "next/navigation";

import { getCustomerSegmentMembers } from "@/lib/quitmed-retail-admin/customer-segments/client";
import CustomerSegmentView from "../cusotmer-segment-components/CustomerSegmentView";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function CustomerSegmentViewPage({
  searchParams,
}: PageProps) {
  const { id } = await searchParams;

  if (!id) {
    redirect("/dashboard/customer-segments");
  }

  const initialResponse = await getCustomerSegmentMembers(id, {
    page: 1,
    limit: 20,
  });

  return <CustomerSegmentView initialResponse={initialResponse} />;
}
