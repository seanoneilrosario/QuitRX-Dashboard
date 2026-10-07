import { notFound } from "next/navigation";

import { getStoreActivityItem } from "../../../../lib/quitmed-retail-admin/store-activity/client";
import StoreActivityView from "../store-activity-components/StoreActivityView";

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function StoreActivityViewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const activityId = params.id;

  if (!activityId) {
    notFound();
  }

  let activity;

  try {
    activity = await getStoreActivityItem(activityId);
  } catch (error) {
    console.error(
      "[StoreActivityViewPage] Failed to load activity:",
      error,
    );
    notFound();
  }

  return <StoreActivityView activity={activity} />;
}