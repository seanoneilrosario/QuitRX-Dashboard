import {
  retailRequest,
  type RetailPagination,
  type RetailRecord,
} from "../collections/client";

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
              typeof item === "object" &&
              !Array.isArray(item),
          ),
      ),
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return [];
  }

  const wrapper =
    payload as Record<string, unknown>;

  for (const key of [
    "data",
    "items",
    "results",
    "products",
    "brands",
    "productTypes",
    "collections",
    "tags",
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

export async function safeRetailList(
  path: string,
): Promise<{
  data: RetailRecord[];
  error?: string;
}> {
  try {
    const payload =
      await retailRequest(path);

    return {
      data: records(payload),
      error: undefined,
    };
  } catch (error) {
    return {
      data: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach QuitHero.",
    };
  }
}

export async function safeRetailPage(
  path: string,
  page = 1,
  limit = 100,
): Promise<{
  data: RetailRecord[];
  pagination: RetailPagination;
  error?: string;
}> {
  try {
    const separator = path.includes("?")
      ? "&"
      : "?";

    const payload =
      await retailRequest(
        `${path}${separator}page=${page}&limit=${limit}`,
      );

    const wrapper =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
        ? (payload as Record<
            string,
            unknown
          >)
        : {};

    const rawPagination =
      wrapper.pagination &&
      typeof wrapper.pagination ===
        "object" &&
      !Array.isArray(wrapper.pagination)
        ? (wrapper.pagination as Record<
            string,
            unknown
          >)
        : {};

    const data = records(payload);

    const pagination: RetailPagination = {
      page:
        Number(rawPagination.page) ||
        page,

      limit:
        Number(rawPagination.limit) ||
        limit,

      total:
        Number(rawPagination.total) ||
        data.length,

      totalPages:
        Number(rawPagination.totalPages) ||
        1,
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

export async function safeRetailAll(
  path: string,
  limit = 100,
): Promise<{
  data: RetailRecord[];
  pagination: RetailPagination;
  error?: string;
}> {
  const first =
    await safeRetailPage(
      path,
      1,
      limit,
    );

  if (
    first.error ||
    first.pagination.totalPages <= 1
  ) {
    return first;
  }

  const data = [
    ...first.data,
  ];

  for (
    let page = 2;
    page <= first.pagination.totalPages;
    page += 1
  ) {
    const result =
      await safeRetailPage(
        path,
        page,
        limit,
      );

    if (result.error) {
      return {
        ...first,
        data: uniqueRecords(data),
        error: result.error,
      };
    }

    data.push(...result.data);
  }

  return {
    ...first,
    data: uniqueRecords(data),
    error: undefined,
  };
}

export async function searchProductVariants(
  search = "",
  page = 1,
  limit = 50,
): Promise<{
  data: RetailRecord[];
  pagination: RetailPagination;
  error?: string;
}> {
  const query = new URLSearchParams();

  if (search.trim()) {
    query.set("search", search.trim());
  }

  query.set("fields", "id,sku,name,price,product");

  return safeRetailPage(
    `/product-variants?${query.toString()}`,
    page,
    limit,
  );
}