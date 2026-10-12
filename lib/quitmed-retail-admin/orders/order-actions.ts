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

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { retailRequest } from "../collections/client";

type CancelOrderResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function cancelOrderAction(
  orderId: string,
): Promise<CancelOrderResult> {
  try {
    const id = orderId.trim();

    if (!id) {
      throw new Error("Order ID is required.");
    }

    // Only allow signed-in staff to cancel orders.
    const session = await auth();
    const staffUser = session?.user as
      | { isStaff?: boolean }
      | undefined;

    if (!staffUser?.isStaff) {
      throw new Error(
        "You must be signed in as staff to cancel orders.",
      );
    }

    await retailRequest(
      `/orders/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
      },
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/orders/details");
    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: "Order cancelled successfully.",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to cancel order.",
    };
  }
}
