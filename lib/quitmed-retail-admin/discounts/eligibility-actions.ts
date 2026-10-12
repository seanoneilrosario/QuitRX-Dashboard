
"use server";

import { safeRetailPage } from "@/lib/quitmed-retail-admin/products/client";

const PAGE_SIZE = 50;

export type EligibilityOption = {
  id: string;
  label: string;
};

export type EligibilitySearchResult = {
  success: boolean;
  data: EligibilityOption[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  message?: string;
};

function getString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

export async function searchDiscountCustomersAction(
  search = "",
  page = 1,
): Promise<EligibilitySearchResult> {
  const query = new URLSearchParams();

  if (search.trim()) {
    query.set("search", search.trim());
  }

  query.set("fields", "id,firstName,lastName,email");

  try {
    const result = await safeRetailPage(
      `/customers?${query.toString()}`,
      page,
      PAGE_SIZE,
    );

    if (result.error) {
      return {
        success: false,
        data: [],
        page,
        totalPages: 1,
        hasMore: false,
        message: result.error,
      };
    }

    const data = result.data.flatMap((customer) => {
      const id = getString(customer, "id");

      if (!id) return [];

      const name = [
        getString(customer, "firstName"),
        getString(customer, "lastName"),
      ]
        .filter(Boolean)
        .join(" ");

      const email = getString(customer, "email");

      const label = email
        ? name
          ? `${name} (${email})`
          : email
        : name || `Customer ${id}`;

      return [{ id, label }];
    });

    return {
      success: true,
      data,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
      hasMore:
        result.pagination.page < result.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      page,
      totalPages: 1,
      hasMore: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load customers.",
    };
  }
}

export async function searchDiscountSegmentsAction(
  search = "",
  page = 1,
): Promise<EligibilitySearchResult> {
  const query = new URLSearchParams();

  if (search.trim()) {
    query.set("search", search.trim());
  }

  query.set("fields", "id,name,isActive");

  try {
    const result = await safeRetailPage(
      `/customer-segments?${query.toString()}`,
      page,
      PAGE_SIZE,
    );

    if (result.error) {
      return {
        success: false,
        data: [],
        page,
        totalPages: 1,
        hasMore: false,
        message: result.error,
      };
    }

    const data = result.data.flatMap((segment) => {
      const id = getString(segment, "id");

      if (!id) return [];

      const name = getString(segment, "name");
      const isActive = segment.isActive;

      const label = name || `Segment ${id}`;

      return [
        {
          id,
          label:
            isActive === false
              ? `${label} (Inactive)`
              : label,
        },
      ];
    });

    return {
      success: true,
      data,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
      hasMore:
        result.pagination.page < result.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      page,
      totalPages: 1,
      hasMore: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load customer segments.",
    };
  }
}
