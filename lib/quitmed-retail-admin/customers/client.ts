import {
  retailRequest,
  type RetailPagination,
  type RetailRecord,
} from "../collections/client";

type CustomersResponse = {
  data?: unknown;
  pagination?: unknown;
};

function records(
  payload: unknown,
): RetailRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is RetailRecord =>
        Boolean(
          item &&
            typeof item === "object" &&
            !Array.isArray(item),
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

  if (Array.isArray(wrapper.data)) {
    return records(wrapper.data);
  }

  if (Array.isArray(wrapper.customers)) {
    return records(wrapper.customers);
  }

  if (Array.isArray(wrapper.items)) {
    return records(wrapper.items);
  }

  if (Array.isArray(wrapper.results)) {
    return records(wrapper.results);
  }

  return [];
}

export async function getCustomers({
  page = 1,
  limit = 20,
  query = "",
  fields,
}: {
  page?: number;
  limit?: number;
  query?: string;
  fields?: string;
} = {}): Promise<{
  data: RetailRecord[];
  pagination: RetailPagination;
}> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (query.trim()) {
    params.set(
      "search",
      query.trim(),
    );
  }

  if (fields?.trim()) {
    params.set(
      "fields",
      fields.trim(),
    );
  }

  const response =
    await retailRequest<CustomersResponse>(
      `/customers?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

  const rawPagination =
    response.pagination &&
    typeof response.pagination ===
      "object" &&
    !Array.isArray(response.pagination)
      ? (response.pagination as Record<
          string,
          unknown
        >)
      : {};

  const data = records(
    response.data,
  );

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
      Math.max(
        1,
        Math.ceil(
          (Number(rawPagination.total) ||
            data.length) / limit,
        ),
      ),
  };

  return {
    data,
    pagination,
  };
}

export async function getCustomer(
  id: string,
  fields?: string,
): Promise<RetailRecord | null> {
  const params = new URLSearchParams();

  if (fields?.trim()) {
    params.set(
      "fields",
      fields.trim(),
    );
  }

  const queryString = params.toString();

  const response =
    await retailRequest<unknown>(
      `/customers/${encodeURIComponent(id)}${
        queryString
          ? `?${queryString}`
          : ""
      }`,
      {
        cache: "no-store",
      },
    );

  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response)
  ) {
    return null;
  }

  const item =
    response as Record<string, unknown>;

  if (
    item.data &&
    typeof item.data === "object" &&
    !Array.isArray(item.data)
  ) {
    return item.data as RetailRecord;
  }

  return item as RetailRecord;
}

export async function updateCustomer(
  id: string,
  data: Record<string, unknown>,
): Promise<RetailRecord | null> {
  console.log(JSON.stringify(data))
  const response =
      await retailRequest(
      `/customers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
        cache: "no-store",
      },
    );
    

  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response)
  ) {
    return null;
  }

  const item =
    response as Record<string, unknown>;

  if (
    item.data &&
    typeof item.data === "object" &&
    !Array.isArray(item.data)
  ) {
    return item.data as RetailRecord;
  }

  return item as RetailRecord;
}

export async function deleteCustomer(id: string): Promise<void> {
  await retailRequest(
    `/customers/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}