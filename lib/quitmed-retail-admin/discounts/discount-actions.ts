"use server";

import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "./client";
import type { ActionResult, Discount, DiscountPayload } from "./types";

export async function createDiscountAction(
  payload: DiscountPayload,
): Promise<ActionResult<Discount>> {
  try {
    const data = await createDiscount(payload);
    return { success: true, data, message: "Discount created successfully." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to create discount.",
    };
  }
}

export async function updateDiscountAction(
  id: string,
  payload: Partial<DiscountPayload>,
): Promise<ActionResult<Discount>> {
  if (!id.trim()) return { success: false, message: "A discount ID is required." };

  try {
    const data = await updateDiscount(id, payload);
    return { success: true, data, message: "Discount updated successfully." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to update discount.",
    };
  }
}

export async function deleteDiscountAction(id: string): Promise<ActionResult> {
  if (!id.trim()) return { success: false, message: "A discount ID is required." };

  try {
    await deleteDiscount(id);
    return { success: true, message: "Discount deleted successfully." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to delete discount.",
    };
  }
}
