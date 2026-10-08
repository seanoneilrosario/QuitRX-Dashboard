import "server-only";

const API_BASE = (
  process.env.QUITHERO_API_BASE_URL ??
  "https://retail-api.quithero.com.au"
).replace(/\/$/, "");

export const RETAIL_CATALOG_TAG = "retail-catalog";

const cachedCatalogPaths = new Set([
  "/products",
  "/product-variants",
  "/brands",
  "/product-type",
  "/collections",
  "/tags",
  "/product-options",
]);

export type RetailRecord =
  Record<string, unknown> & {
    id?: string;
  };

export type RetailPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type RetailRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

const wait = (milliseconds: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  );

export function retryDelay(
  response: Response,
  attempt: number,
) {
  const retryAfter =
    response.headers.get("retry-after");

  const seconds = retryAfter
    ? Number(retryAfter)
    : Number.NaN;

  if (Number.isFinite(seconds)) {
    return Math.min(
      Math.max(seconds * 1000, 1000),
      30000,
    );
  }

  const date = retryAfter
    ? Date.parse(retryAfter)
    : Number.NaN;

  if (Number.isFinite(date)) {
    return Math.min(
      Math.max(date - Date.now(), 1000),
      30000,
    );
  }

  return 1000 * (2 ** attempt);
}

export function apiKey() {
  let value =
    process.env.QUITHERO_API_KEY?.trim();

  if (!value) {
    throw new Error(
      "QUITHERO_API_KEY is not configured.",
    );
  }

  value = value.replace(
    /^QUITHERO_API_KEY\s*=\s*/,
    "",
  );

  if (
    (value.startsWith('"') &&
      value.endsWith('"')) ||
    (value.startsWith("'") &&
      value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\\$/g, "$");

  if (!value) {
    throw new Error(
      "QUITHERO_API_KEY is not configured.",
    );
  }

  return value;
}

function apiErrorMessage(body: unknown) {
  if (typeof body === "string") {
    return body.trim();
  }

  if (!body || typeof body !== "object") {
    return "";
  }

  const { message, error } =
    body as Record<string, unknown>;

  if (Array.isArray(message)) {
    return message
      .filter(
        (item): item is string =>
          typeof item === "string",
      )
      .join(" ");
  }

  if (typeof message === "string") {
    return message.trim();
  }

  if (typeof error === "string") {
    return error.trim();
  }

  return "";
}

export async function retailRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
) {
  const method = (
    init.method ?? "GET"
  ).toUpperCase();

  const cacheCatalog =
    method === "GET" &&
    cachedCatalogPaths.has(
      path.split("?")[0],
    ) &&
    init.cache !== "no-store";

  const suppliedHeaders =
    (init.headers ?? {}) as Record<
      string,
      string
    >;

  const usesBearerToken =
    Object.keys(suppliedHeaders).some(
      (name) =>
        name.toLowerCase() ===
        "authorization",
    );

  const usesFormData =
    typeof FormData !== "undefined" &&
    init.body instanceof FormData;

  const request: RetailRequestInit = {
    ...init,

    headers: {
      ...(usesFormData
        ? {}
        : {
            "content-type":
              "application/json",
          }),

      ...(usesBearerToken
      ? {}
      : {
          "x-api-key": apiKey(),
        }),

      ...init.headers,
    },

    cache: cacheCatalog
      ? "force-cache"
      : "no-store",

    next: cacheCatalog
      ? {
          revalidate: 30,
          tags: [RETAIL_CATALOG_TAG],
        }
      : undefined,
  };

  let response = await fetch(
    `${API_BASE}${path}`,
    request as RequestInit,
  );

  const canRetry =
    method === "GET" ||
    (method === "PATCH" &&
      path.endsWith("/bundle"));

  if (canRetry) {
    for (
      let attempt = 0;
      response.status === 429 &&
      attempt < 4;
      attempt += 1
    ) {
      await wait(
        retryDelay(response, attempt),
      );

      response = await fetch(
        `${API_BASE}${path}`,
        request as RequestInit,
      );
    }
  }

  const responseText =
    await response.text();

  let body: unknown;

  try {
    body = responseText
      ? JSON.parse(responseText)
      : undefined;
  } catch {
    body = responseText;
  }

  if (!response.ok) {
    const detail =
      apiErrorMessage(body);

    const requestPath =
      path.split("?")[0];

    const message = detail
      ? `QuitHero API returned ${response.status}: ${detail}`
      : `QuitHero API returned ${response.status}.`;

    throw new Error(
      `${message} (${method} ${requestPath})`,
    );
  }

  return body as T;
}