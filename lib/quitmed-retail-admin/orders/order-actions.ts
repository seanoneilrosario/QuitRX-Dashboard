"use server";

import { deleteOrder } from "./client";

export async function deleteOrderAction(orderId: string) {
  try {
    await deleteOrder(orderId);

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "[order-actions] delete failed",
      error,
    );

    return {
      success: false,
      error: "Failed to delete order.",
    };
  }
}