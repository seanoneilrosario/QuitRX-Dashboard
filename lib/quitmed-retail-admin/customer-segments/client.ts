
import { retailRequest } from "../collections/client";

export type CustomerSegmentMatchMode = "ALL" | "ANY";

export type CustomerSegmentRule = {
  field: string;
  operator: string;
  value?: unknown;
};

export type CustomerSegment = {
  id: string;
  name: string;
  description: string | null;
  matchMode: CustomerSegmentMatchMode;
  rules: CustomerSegmentRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
  };
};

export type CustomerSegmentInput = {
  name: string;
  description?: string | null;
  matchMode?: CustomerSegmentMatchMode;
  rules?: CustomerSegmentRule[];
  isActive?: boolean;
};

function unwrapObject(payload: unknown): Record<string, unknown> | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (
    record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
  ) {
    return record.data as Record<string, unknown>;
  }

  return record;
}

function parseSegment(payload: unknown): CustomerSegment {
  const record = unwrapObject(payload);

  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.name !== "string"
  ) {
    throw new Error("Invalid customer segment response.");
  }

  return record as unknown as CustomerSegment;
}

export async function getCustomerSegments(): Promise<CustomerSegment[]> {
  const response = await retailRequest<unknown>(
    "/customer-segments",
    { cache: "no-store" },
  );

  let items: unknown[] = [];

  if (Array.isArray(response)) {
    items = response;
  } else if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response)
  ) {
    const wrapper = response as Record<string, unknown>;

    if (Array.isArray(wrapper.data)) {
      items = wrapper.data;
    } else if (Array.isArray(wrapper.segments)) {
      items = wrapper.segments;
    }
  }

  return items.map(parseSegment);
}

export async function getCustomerSegment(
  id: string,
): Promise<CustomerSegment> {
  const response = await retailRequest<unknown>(
    `/customer-segments/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );

  return parseSegment(response);
}

export async function createCustomerSegment(
  data: CustomerSegmentInput,
): Promise<CustomerSegment> {
  const response = await retailRequest<unknown>(
    "/customer-segments",
    {
      method: "POST",
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );

  return parseSegment(response);
}

export async function updateCustomerSegment(
  id: string,
  data: Partial<CustomerSegmentInput>,
): Promise<CustomerSegment> {
  const response = await retailRequest<unknown>(
    `/customer-segments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );

  return parseSegment(response);
}

export async function refreshCustomerSegment(
  id: string,
): Promise<{ segmentId: string; matchedCustomers: number }> {
  return retailRequest<{ segmentId: string; matchedCustomers: number }>(
    `/customer-segments/${encodeURIComponent(id)}/refresh`,
    {
      method: "POST",
      cache: "no-store",
    },
  );
}

export async function deleteCustomerSegment(
  id: string,
): Promise<void> {
  await retailRequest(
    `/customer-segments/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}

export type CustomerSegmentCustomer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  numberOfOrders: number;
  totalSpent: number | string;
  currencyCode: string | null;
  state: string | null;
  createdAt: string;
};

export type CustomerSegmentMembersResponse = {
  segment: {
    id: string;
    name: string;
    description: string | null;
    matchMode: CustomerSegmentMatchMode;
    isActive: boolean;
    rules: CustomerSegmentRule[];
  };
  data: CustomerSegmentCustomer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getCustomerSegmentMembers(
  id: string,
  {
    page = 1,
    limit = 20,
    search = "",
  }: {
    page?: number;
    limit?: number;
    search?: string;
  } = {},
): Promise<CustomerSegmentMembersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return retailRequest<CustomerSegmentMembersResponse>(
    `/customer-segments/${encodeURIComponent(id)}/customers?${params.toString()}`,
    {
      cache: "no-store",
    },
  );
}