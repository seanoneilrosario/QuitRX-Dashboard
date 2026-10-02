import "server-only";

import {
  records,
  RetailPagination,
  apiErrorMessage,
  retryDelay,
  apiKey,
  RETAIL_CATALOG_TAG,
} from "./quithero-admin";

const API_BASE = (
  process.env.QUITHERO_API_BASE_URL ??
  "https://retail-api.quithero.com.au"
).replace(/\/$/, "");

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retailRequestDashboard<T = unknown>(
  path: string,
  init: RequestInit = {},
  fresh = false,
) {
  const suppliedHeaders = (init.headers ?? {}) as Record<string, string>;
  const usesBearerToken = Object.keys(suppliedHeaders).some(
    (name) => name.toLowerCase() === "authorization",
  );

  const usesFormData =
    typeof FormData !== "undefined" &&
    init.body instanceof FormData;

  const request: RequestInit = {
    ...init,
    headers: {
      ...(usesFormData
        ? {}
        : { "content-type": "application/json" }),
      ...(usesBearerToken && !usesFormData
        ? {}
        : { "x-api-key": apiKey() }),
      ...init.headers,
    },
    cache: fresh ? "no-store" : "force-cache",
    next: fresh
      ? undefined
      : {
          revalidate: 30,
          tags: [RETAIL_CATALOG_TAG],
        },
  };

  let response = await fetch(`${API_BASE}${path}`, request);
  const method = (init.method ?? "GET").toUpperCase();

  const canRetry =
    method === "GET" ||
    (method === "PATCH" && path.endsWith("/bundle"));

  if (canRetry) {
    for (
      let attempt = 0;
      response.status === 429 && attempt < 4;
      attempt += 1
    ) {
      await wait(retryDelay(response, attempt));

      response = await fetch(`${API_BASE}${path}`, request);
    }
  }

  const text = await response.text();
  let body: unknown;

  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = apiErrorMessage(body);
    const requestPath = path.split("?")[0];

    console.error("[QuitHero dashboard] API request failed", {
      method,
      path: requestPath,
      status: response.status,
      environment: process.env.VERCEL_ENV ?? "local",
      deployment: process.env.VERCEL_URL,
      requestId: response.headers?.get("x-request-id") ?? undefined,
    });

    const message = detail
      ? `QuitHero API returned ${response.status}: ${detail}`
      : `QuitHero API returned ${response.status}.`;

    throw new Error(
      `${message} (${method} ${requestPath})`,
    );
  }

  return body as T;
}



export async function safeRetailDashboard(
  path: string,
  page = 1,
  limit = 50,
  fresh = false,
) {
  try {
    const separator = path.includes("?") ? "&" : "?";

    const payload = await retailRequestDashboard<unknown>(
      `${path}${separator}page=${page}&limit=${limit}&fields=id,name,slug,status,inventory,brand,productType`,
      {},
      fresh,
    );

    const wrapper =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};

    const raw =
      wrapper.pagination &&
      typeof wrapper.pagination === "object"
        ? (wrapper.pagination as Record<string, unknown>)
        : {};

    const pagination: RetailPagination = {
      page: Number(raw.page) || page,
      limit: Number(raw.limit) || limit,
      total: Number(raw.total) || records(payload).length,
      totalPages: Number(raw.totalPages) || 1,
    };

    return {
      data: records(payload),
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