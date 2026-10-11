import "server-only";
import { Discount, DiscountPayload } from "../discounts/types";


const API_BASE = (
  process.env.QUITHERO_API_BASE_URL ??
  "https://retail-api.quithero.com.au"
).replace(/\/+$/, "");

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;

  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds * 1000, 1000), 30000);
  }

  const date = retryAfter ? Date.parse(retryAfter) : Number.NaN;

  if (Number.isFinite(date)) {
    return Math.min(Math.max(date - Date.now(), 1000), 30000);
  }

  return 1000 * (2 ** attempt);
}

function apiKey() {
  let value = process.env.QUITHERO_API_KEY?.trim();

  if (!value) {
    throw new Error("QUITHERO_API_KEY is not configured.");
  }

  value = value.replace(/^QUITHERO_API_KEY\s*=\s*/, "");

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\\$/g, "$");

  if (!value) {
    throw new Error("QUITHERO_API_KEY is not configured.");
  }

  return value;
}

function apiErrorMessage(body: unknown) {
  if (typeof body === "string") return body.trim();
  if (!body || typeof body !== "object") return "";

  const { message, error } = body as Record<string, unknown>;

  if (Array.isArray(message)) {
    return message
      .filter((item): item is string => typeof item === "string")
      .join(" ");
  }

  if (typeof message === "string") return message.trim();
  if (typeof error === "string") return error.trim();

  return "";
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const suppliedHeaders = (init.headers ?? {}) as Record<string, string>;
  const usesBearerToken = Object.keys(suppliedHeaders).some(
    (name) => name.toLowerCase() === "authorization",
  );
  const usesFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  const requestInit: RequestInit = {
    ...init,
    headers: {
      ...(usesFormData ? {} : { "content-type": "application/json" }),
      ...(usesBearerToken ? {} : { "x-api-key": apiKey() }),
      ...init.headers,
    },
    // Discount eligibility and usage can change at any time; don't cache them.
    cache: "no-store",
  };

  let response = await fetch(`${API_BASE}${path}`, requestInit);
  const canRetry = method === "GET";

  if (canRetry) {
    for (
      let attempt = 0;
      response.status === 429 && attempt < 4;
      attempt += 1
    ) {
      await wait(retryDelay(response, attempt));
      response = await fetch(`${API_BASE}${path}`, requestInit);
    }
  }

  const responseText = await response.text();
  let body: unknown;

  try {
    body = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    body = responseText;
  }

  if (!response.ok) {
    const detail = apiErrorMessage(body);
    const requestPath = path.split("?")[0];
    const message = detail
      ? `QuitHero API returned ${response.status}: ${detail}`
      : `QuitHero API returned ${response.status}.`;

    throw new Error(`${message} (${method} ${requestPath})`);
  }

  return body as T;
}

function unwrapDiscountList(result: unknown): Discount[] {
  if (Array.isArray(result)) return result as Discount[];

  if (typeof result === "object" && result !== null) {
    const record = result as {
      data?: unknown;
      items?: unknown;
      discounts?: unknown;
    };

    if (Array.isArray(record.data)) return record.data as Discount[];
    if (Array.isArray(record.items)) return record.items as Discount[];
    if (Array.isArray(record.discounts)) return record.discounts as Discount[];
  }

  return [];
}

export async function listDiscounts(): Promise<Discount[]> {
  const result = await request<unknown>("/discounts");
  return unwrapDiscountList(result);
}

export async function getDiscount(id: string): Promise<Discount> {
  return request<Discount>(`/discounts/${encodeURIComponent(id)}`);
}

export async function createDiscount(payload: DiscountPayload): Promise<Discount> {
  return request<Discount>("/discounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDiscount(
  id: string,
  payload: Partial<DiscountPayload>,
): Promise<Discount> {
  return request<Discount>(`/discounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDiscount(id: string): Promise<void> {
  await request<unknown>(`/discounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
