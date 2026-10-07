import Products from "./products-component/Products";

import { retailRequest } from "@/lib/quitmed-retail-admin/collections/client";

type RetailRecord = Record<string, any>;

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProductsResult = {
  data: RetailRecord[];
  pagination: Pagination;
};

async function getProducts(
  page: number,
  limit: number,
  query: string,
  status: string,
): Promise<ProductsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    fields:
      "id,name,slug,brand,productType,inventory,status",
  });

  // IMPORTANT:
  // "q" is our dashboard URL parameter,
  // but QuitHero expects "search".
  if (query) {
    params.set("search", query);
  }

  if (status) {
    params.set("status", status);
  }

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
    Number(rawPagination.total) || data.length;

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

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const page = Math.max(
    1,
    Number(params.page) || 1,
  );

  const query =
    typeof params.q === "string"
      ? params.q.trim()
      : "";

  const status =
    typeof params.status === "string"
      ? params.status
      : "";

  let result: ProductsResult = {
    data: [],
    pagination: {
      page,
      limit: 50,
      total: 0,
      totalPages: 1,
    },
  };

  let error: string | undefined;

  try {
    result = await getProducts(
      page,
      50,
      query,
      status,
    );
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Unable to load products.";
  }

  return (
    <Products
      products={result.data}
      pagination={result.pagination}
      query={query}
      status={status}
      error={error}
    />
  );
}