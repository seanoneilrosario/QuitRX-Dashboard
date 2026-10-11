
"use server";

import { revalidatePath } from "next/cache";

import {
  createCustomerSegment,
  updateCustomerSegment,
  deleteCustomerSegment,
  refreshCustomerSegment,
  type CustomerSegmentInput,
  getCustomerSegmentMembers,
} from "@/lib/quitmed-retail-admin/customer-segments/client";

const SEGMENTS_PATH = "/dashboard/customer-segments";

export async function createCustomerSegmentAction(
  data: CustomerSegmentInput,
) {
  const segment = await createCustomerSegment(data);

  revalidatePath(SEGMENTS_PATH);

  return segment;
}

export async function updateCustomerSegmentAction(
  id: string,
  data: Partial<CustomerSegmentInput>,
) {
  const segment = await updateCustomerSegment(id, data);

  revalidatePath(SEGMENTS_PATH);

  return segment;
}

export async function refreshCustomerSegmentAction(id: string) {
  const result = await refreshCustomerSegment(id);

  revalidatePath(SEGMENTS_PATH);

  return result;
}

export async function deleteCustomerSegmentAction(id: string) {
  try {
    await deleteCustomerSegment(id);

    revalidatePath(SEGMENTS_PATH);

    return { success: true };
  } catch (error) {
    console.error(
      "[customer-segment-actions] delete failed",
      error,
    );

    return {
      success: false,
      error: "Failed to delete customer segment.",
    };
  }
}

export async function getCustomerSegmentMembersAction(
  id: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {},
) {
  return getCustomerSegmentMembers(id, options);
}