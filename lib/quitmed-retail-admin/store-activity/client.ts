import { auth } from "@/auth";
import { retailRequest } from "../collections/client";

export type StoreActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: string | null;
  userId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  metadata?: unknown;
  createdAt: string;
};

export async function getStoreActivity(): Promise<StoreActivityItem[]> {
  const session = await auth();

  const accessToken = (
    session?.user as { accessToken?: string } | undefined
  )?.accessToken;

  if (!accessToken) {
    throw new Error(
      "Your staff session does not include an access token. Please sign in again.",
    );
  }

  return retailRequest<StoreActivityItem[]>(
    "/audit-logs?fields=id,action,entityType,entityId,source,createdAt",
    {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export async function getStoreActivityItem(
  id: string,
): Promise<StoreActivityItem> {
  const session = await auth();

  const accessToken = (
    session?.user as { accessToken?: string } | undefined
  )?.accessToken;

  if (!accessToken) {
    throw new Error(
      "Your staff session does not include an access token. Please sign in again.",
    );
  }

  return retailRequest<StoreActivityItem>(
    `/audit-logs/${encodeURIComponent(id)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
}