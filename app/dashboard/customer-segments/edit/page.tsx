import { redirect } from "next/navigation";

import { getCustomerSegment } from "@/lib/quitmed-retail-admin/customer-segments/client";
import CustomerSegmentEdit from "../cusotmer-segment-components/CustomerSegmentEdit";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function EditCustomerSegmentPage({
  searchParams,
}: PageProps) {
  const { id } = await searchParams;

  if (!id) {
    redirect("/dashboard/customer-segments");
  }

  const segment = await getCustomerSegment(id);

  return <CustomerSegmentEdit initialSegment={segment} />;
}