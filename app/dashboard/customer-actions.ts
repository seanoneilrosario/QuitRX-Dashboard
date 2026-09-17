"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { retailRequest } from "@/lib/quithero-admin";

export async function createCustomer(
  _previous: { message: string },
  formData: FormData,
): Promise<{ message: string }> {
  let destination = "/dashboard/customers";
  try {
    const session = await auth();
    if (!session?.user || !(session.user as typeof session.user & { isStaff?: boolean }).isStaff)
      throw new Error("You must be signed in as staff to add customers.");

    const email = String(formData.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

    const body: Record<string, string | boolean | string[]> = { email };
    for (const field of [
      "firstName",
      "lastName",
      "phone",
      "scriptId",
      "scriptValidity",
      "renewalForm",
      "gender",
      "vapeTag",
      "pouchTag",
      "document",
      "socLogin",
      "scriptUploaded",
    ]) {
      const value = String(formData.get(field) ?? "").trim();
      if (value) body[field] = value;
    }
    for (const [field, label] of [
      ["scriptExpiry", "Script expiry"],
      ["birthday", "Birthday"],
    ]) {
      const value = String(formData.get(field) ?? "").trim();
      if (!value) continue;
      const date = new Date(`${value}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new Error(`${label} must be a valid date.`);
      body[field] = date.toISOString();
    }
    for (const field of ["consultPurchase", "scriptActive"]) {
      const value = String(formData.get(field) ?? "false");
      if (value !== "true" && value !== "false") throw new Error(`Invalid ${field} value.`);
      body[field] = value === "true";
    }
    body.tags = [
      ...new Set(
        String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    const saved = await retailRequest<unknown>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const wrapper = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
    const customer =
      wrapper.data && typeof wrapper.data === "object"
        ? (wrapper.data as Record<string, unknown>)
        : wrapper;
    if (typeof customer.id === "string" && customer.id)
      destination = `/dashboard/customers/details?id=${encodeURIComponent(customer.id)}`;
  } catch (error) {
    console.error("[QuitRX] Add customer failed", error);
    return { message: error instanceof Error ? error.message : "Unable to add customer." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(destination);
}
