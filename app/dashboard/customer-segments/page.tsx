import { getCustomerSegments } from "@/lib/quitmed-retail-admin/customer-segments/client";
import CustomerSegmentsList from "./cusotmer-segment-components/CustomerSegmentsList";


export const dynamic = "force-dynamic";

export default async function CustomerSegmentsPage() {
  const segments = await getCustomerSegments();

  return <CustomerSegmentsList initialSegments={segments} />;
}