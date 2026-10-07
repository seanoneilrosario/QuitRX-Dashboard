"use server";

import {
    deleteCustomer,
  updateCustomer,
} from "@/lib/quitmed-retail-admin/customers/client";

import { revalidatePath } from "next/cache";
import { retailRequest } from "../collections/client";

export async function updateCustomerAction(
  customerId: string,
  formData: FormData,
) {
  const tagsValue = String(
    formData.get("tags") ?? "",
  );

  const data = {
    firstName:
      String(
        formData.get("firstName") ?? "",
      ).trim() || null,

    lastName:
      String(
        formData.get("lastName") ?? "",
      ).trim() || null,

    email:
      String(
        formData.get("email") ?? "",
      ).trim() || null,

    phone:
      String(
        formData.get("phone") ?? "",
      ).trim() || null,

    numberOfOrders: Number(
      formData.get("numberOfOrders") ?? 0,
    ),

    totalSpent: Number(
      formData.get("totalSpent") ?? 0,
    ),

    currencyCode:
      String(
        formData.get("currencyCode") ?? "",
      ).trim() || null,

    tags: tagsValue
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),

    taxExempt:
      formData.get("taxExempt") ===
      "true",

    verifiedEmail:
      formData.get("verifiedEmail") ===
      "true",

    state:
      String(
        formData.get("state") ?? "",
      ).trim() || null,

    consultPurchase:
      formData.get("consultPurchase") ===
      "true",

    scriptId:
      String(
        formData.get("scriptId") ?? "",
      ).trim() || null,

    scriptExpiry: (() => {
      const value = String(
        formData.get("scriptExpiry") ?? "",
      ).trim();

      if (!value) {
        return null;
      }

      return new Date(
        `${value}T00:00:00.000Z`,
      ).toISOString();
    })(),

    birthday: (() => {
      const value = String(
        formData.get("birthday") ?? "",
      ).trim();

      if (!value) {
        return null;
      }

      return new Date(
        `${value}T00:00:00.000Z`,
      ).toISOString();
    })(),

    scriptValidity:
      String(
        formData.get("scriptValidity") ?? "",
      ).trim() || null,

    renewalForm:
      String(
        formData.get("renewalForm") ?? "",
      ).trim() || null,

    gender:
      String(
        formData.get("gender") ?? "",
      ).trim() || null,

    vapeTag:
      String(
        formData.get("vapeTag") ?? "",
      ).trim() || null,

    pouchTag:
      String(
        formData.get("pouchTag") ?? "",
      ).trim() || null,

    document:
      String(
        formData.get("document") ?? "",
      ).trim() || null,

    socLogin:
      String(
        formData.get("socLogin") ?? "",
      ).trim() || null,

    scriptUploaded:
      String(
        formData.get("scriptUploaded") ?? "",
      ).trim() || null,

    scriptActive:
      formData.get("scriptActive") ===
      "true",
  };

  const updated =
    await updateCustomer(
      customerId,
      data,
    );

  revalidatePath(
    `/dashboard/customers/view?id=${encodeURIComponent(customerId)}`,
  );

  if (!updated) {
    throw new Error(
      "Failed to update customer.",
    );
  }

  return updated;
}

export async function deleteCustomerAction(id: string) {
  try {
    await deleteCustomer(id);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[customer-actions] delete failed", error);

    return {
      success: false,
      error: "Failed to delete customer.",
    };
  }
}

export async function createCustomerAddressAction(
  customerId: string,
  formData: FormData,
) {
  const address = {
    address1: String(
      formData.get("address1") ?? "",
    ).trim(),

    address2: String(
      formData.get("address2") ?? "",
    ).trim(),

    city: String(
      formData.get("city") ?? "",
    ).trim(),

    state: String(
      formData.get("state") ?? "",
    ).trim(),

    postcode: String(
      formData.get("postcode") ?? "",
    ).trim(),

    country: String(
      formData.get("country") ?? "",
    ).trim(),
  };

  const created = await retailRequest(
    `/customers/${encodeURIComponent(
      customerId,
    )}/addresses`,
    {
      method: "POST",
      body: JSON.stringify(address),
      cache: "no-store",
    },
  );

  revalidatePath(
    `/dashboard/customers/view?id=${encodeURIComponent(
      customerId,
    )}`,
  );

  return created;
}

export async function setDefaultAddressAction(
  customerId: string,
  addressId: string,
) {
  return retailRequest(
    `/customers/${encodeURIComponent(
      customerId,
    )}/addresses/${encodeURIComponent(
      addressId,
    )}/default`,
    {
      method: "PATCH",
      cache: "no-store",
    },
  );
}