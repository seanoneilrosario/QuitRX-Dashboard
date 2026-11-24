"use server";

import { createInvoicePaymentSession } from "@/lib/quitmed-retail-admin/invoices/public-client";

type StartPaymentResult =
  { success: true; redirectUrl: string } | { success: false; message: string };

function isEwayUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "ewaypayments.com" ||
        url.hostname.endsWith(".ewaypayments.com"))
    );
  } catch {
    return false;
  }
}

export async function startInvoicePayment(
  token: string,
): Promise<StartPaymentResult> {
  try {
    if (!token.trim()) {
      return { success: false, message: "This payment link is invalid." };
    }

    const session = await createInvoicePaymentSession(token);

    if (!isEwayUrl(session.sharedPaymentUrl)) {
      return {
        success: false,
        message: "The payment provider returned an invalid redirect.",
      };
    }

    return { success: true, redirectUrl: session.sharedPaymentUrl };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Payment could not be started. Please try again.",
    };
  }
}
