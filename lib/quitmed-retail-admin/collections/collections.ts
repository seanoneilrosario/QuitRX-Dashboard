import "server-only";

import {
  retailRequest,
  type RetailRecord,
  type RetailPagination,
} from "@/lib/quitmed-retail-admin/collections/client";

function uniqueRecords(
  items: RetailRecord[],
): RetailRecord[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (
      typeof item.id !== "string" ||
      !item.id
    ) {
      return true;
    }

    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);

    return true;
  });
}

function records(
  payload: unknown,
): RetailRecord[] {
  if (Array.isArray(payload)) {
    return uniqueRecords(
      payload.filter(
        (item): item is RetailRecord =>
          Boolean(
            item &&
              typeof item === "object",
          ),
      ),
    );
  }

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return [];
  }

  const wrapper =
    payload as Record<string, unknown>;

  for (const key of [
    "data",
    "items",
    "results",
    "collections",
  ]) {
    const result = records(
      wrapper[key],
    );

    if (result.length) {
      return result;
    }
  }

  return [];
}

/**
 * Collections list
 */
export async function safeCollectionsPage(
  page = 1,
  limit = 50,
) {
  try {
    const payload =
    await retailRequest<unknown>(
      `/collections?page=${page}&limit=${limit}&fields=id,name,slug,type,match,image,productCount`,
      {
        cache: "no-store",
      },
    );

    const wrapper =
      payload &&
      typeof payload === "object"
        ? (payload as Record<
            string,
            unknown
          >)
        : {};

    const raw =
      wrapper.pagination &&
      typeof wrapper.pagination ===
        "object"
        ? (wrapper.pagination as Record<
            string,
            unknown
          >)
        : {};

    const data = records(payload);

    const pagination: RetailPagination = {
      page:
        Number(raw.page) || page,

      limit:
        Number(raw.limit) || limit,

      total:
        Number(raw.total) ||
        data.length,

      totalPages:
        Number(raw.totalPages) || 1,
    };

    return {
      data,
      pagination,
      error: undefined,
    };
  } catch (error) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach QuitHero.",
    };
  }
}

/**
 * Collection data used by the edit page.
 */
export async function safeCollectionForEdit(
  id: string,
) {
  try {
    const payload =
      await retailRequest<unknown>(
        `/collections/${encodeURIComponent(id)}?productFields=id,name,slug`,
      );

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return {
        data: undefined,
        error: undefined,
      };
    }

    const wrapper =
      payload as Record<
        string,
        unknown
      >;

    const rawData =
      wrapper.data &&
      typeof wrapper.data ===
        "object" &&
      !Array.isArray(wrapper.data)
        ? (wrapper.data as RetailRecord)
        : (wrapper as RetailRecord);

    const data: RetailRecord = {
      ...rawData,
    };

    if (
      wrapper.pagination &&
      typeof wrapper.pagination ===
        "object" &&
      !Array.isArray(
        wrapper.pagination,
      )
    ) {
      data.pagination =
        wrapper.pagination;
    }

    return {
      data,
      error: undefined,
    };
  } catch (error) {
    return {
      data: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach QuitHero.",
    };
  }
}

/**
 * Products inside a collection.
 */
export async function safeCollectionPage(
  id: string,
  page = 1,
  limit = 24,
  status?: string,
) {
  const productFields =
    "id,name,slug,status,brand,productType";

  const params = new URLSearchParams({
    productFields,
    page: String(page),
    limit: String(limit),
  });

  if (status) {
    params.set("status", status);
  }

  try {
    const payload =
      await retailRequest<unknown>(
        `/collections/${encodeURIComponent(id)}?${params.toString()}`,
      );

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return {
        data: undefined,
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
        error: undefined,
      };
    }

    const wrapper =
      payload as Record<
        string,
        unknown
      >;

    const collection =
      wrapper.data &&
      typeof wrapper.data ===
        "object" &&
      !Array.isArray(wrapper.data)
        ? (wrapper.data as RetailRecord)
        : undefined;

    const products =
      collection &&
      Array.isArray(
        collection.products,
      )
        ? (
            collection.products as RetailRecord[]
          )
        : [];

    const rawPagination =
      wrapper.pagination &&
      typeof wrapper.pagination ===
        "object" &&
      !Array.isArray(
        wrapper.pagination,
      )
        ? (wrapper.pagination as Record<
            string,
            unknown
          >)
        : {};

    const pagination: RetailPagination = {
      page:
        Number(rawPagination.page) ||
        page,

      limit:
        Number(rawPagination.limit) ||
        limit,

      total:
        Number(rawPagination.total) ||
        products.length,

      totalPages:
        Number(
          rawPagination.totalPages,
        ) || 1,
    };

    return {
      data: collection,
      products,
      pagination,
      error: undefined,
    };
  } catch (error) {
    return {
      data: undefined,
      products: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach QuitHero.",
    };
  }
}

/**
 * Collection Edit - Fetch all products.
 */
export async function getCollectionEditProducts(
  page = 1,
  limit = 50,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    fields: "id,name,slug",
  });

  const payload = await retailRequest<unknown>(
    `/products?${params.toString()}`,
    {
      cache: "no-store",
    },
  );

  const wrapper =
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const data = Array.isArray(wrapper.data)
    ? wrapper.data.filter(
        (item): item is RetailRecord =>
          Boolean(
            item &&
              typeof item === "object" &&
              !Array.isArray(item),
          ),
      )
    : [];

  const rawPagination =
    wrapper.pagination &&
    typeof wrapper.pagination === "object" &&
    !Array.isArray(wrapper.pagination)
      ? (wrapper.pagination as Record<string, unknown>)
      : {};

  const paginationPage =
    Number(rawPagination.page) || page;

  const paginationLimit =
    Number(rawPagination.limit) || limit;

  const total =
    Number(rawPagination.total) ||
    data.length;

  const totalPagesFromApi =
    Number(rawPagination.totalPages);

  const totalPages =
    Number.isFinite(totalPagesFromApi) &&
    totalPagesFromApi > 0
      ? totalPagesFromApi
      : Math.max(
          1,
          Math.ceil(
            total / paginationLimit,
          ),
        );

  return {
    data,
    pagination: {
      page: paginationPage,
      limit: paginationLimit,
      total,
      totalPages,
    },
  };
}

export async function getAllCollectionProductIds(
  id: string,
) {
  const limit = 100;
  let page = 1;

  const productIds: string[] = [];

  while (true) {
    const params = new URLSearchParams({
      productFields: "id",
      page: String(page),
      limit: String(limit),
    });

    const payload = await retailRequest<unknown>(
      `/collections/${encodeURIComponent(id)}?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    const wrapper =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const data =
      wrapper.data &&
      typeof wrapper.data === "object" &&
      !Array.isArray(wrapper.data)
        ? (wrapper.data as Record<string, unknown>)
        : {};

    const products = Array.isArray(data.products)
      ? data.products
      : [];

    for (const product of products) {
      if (
        product &&
        typeof product === "object" &&
        !Array.isArray(product)
      ) {
        const idValue = (product as Record<string, unknown>).id;

        if (typeof idValue === "string" && idValue) {
          productIds.push(idValue);
        }
      }
    }

    const pagination =
      wrapper.pagination &&
      typeof wrapper.pagination === "object" &&
      !Array.isArray(wrapper.pagination)
        ? (wrapper.pagination as Record<string, unknown>)
        : {};

    const totalPages =
      Number(pagination.totalPages) || 1;

    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  return [...new Set(productIds)];
}