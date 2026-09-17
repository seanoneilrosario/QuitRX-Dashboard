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

    const body: Record<string, string> = { email };
    for (const field of ["firstName", "lastName", "phone"]) {
      const value = String(formData.get(field) ?? "").trim();
      if (value) body[field] = value;
    }
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
    return { message: error instanceof Error ? error.message : "Unable to add customer." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(destination);
}
