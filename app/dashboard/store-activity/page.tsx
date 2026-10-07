
import { getStoreActivity } from "../../../lib/quitmed-retail-admin/store-activity/client";
import StoreActivity from "./store-activity-components/StoreActivity";


export default async function StoreActivityPage() {
  const activities = await getStoreActivity();

  return <StoreActivity activities={activities} />;
}