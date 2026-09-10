import "server-only";

type StorefrontRule = { field: string; operator: string; value: string };
type StorefrontCollection = {
  id: string;
  name: string;
  slug: string;
  type: "MANUAL" | "DYNAMIC";
  match: "ALL" | "ANY";
  image?: string;
  productIds?: string[];
  rules?: StorefrontRule[];
};

function config() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (!projectId || !dataset || !token) throw new Error("Sanity storefront sync is not configured.");
  return { projectId, dataset, token };
}

function documentId(retailCollectionId: string) {
  return `retailCollection.${retailCollectionId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function recommendationDocumentId(productId: string) {
  return `frequentlyBoughtTogether.${productId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export type FrequentlyBoughtTogether = {
  productId: string;
  relatedProductIds: string[];
  updatedAt?: string;
};

export async function getAllFrequentlyBoughtTogether() {
  const { projectId, dataset, token } = config();
  const query = `*[_type == "frequentlyBoughtTogether"] | order(updatedAt desc) { productId, relatedProductIds, updatedAt }`;
  const params = new URLSearchParams({ query });
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/query/${encodeURIComponent(dataset)}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Storefront recommendations could not be loaded (${response.status}).`);
  const body = await response.json() as { result?: unknown };
  if (!Array.isArray(body.result)) return [];
  return body.result.flatMap((item): FrequentlyBoughtTogether[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.productId !== "string" || !Array.isArray(record.relatedProductIds)) return [];
    return [{
      productId: record.productId,
      relatedProductIds: record.relatedProductIds.filter((id): id is string => typeof id === "string"),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    }];
  });
}

export async function getFrequentlyBoughtTogether(productId: string) {
  const { projectId, dataset, token } = config();
  const query = `*[_type == "frequentlyBoughtTogether" && productId == $productId][0].relatedProductIds`;
  const params = new URLSearchParams({ query, "$productId": JSON.stringify(productId) });
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/query/${encodeURIComponent(dataset)}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Storefront recommendations could not be loaded (${response.status}).`);
  const body = await response.json() as { result?: unknown };
  return Array.isArray(body.result) ? body.result.filter((id): id is string => typeof id === "string") : [];
}

export async function syncFrequentlyBoughtTogether(productId: string, relatedProductIds: string[]) {
  const { projectId, dataset, token } = config();
  const id = recommendationDocumentId(productId);
  const mutation = relatedProductIds.length ? {
    createOrReplace: {
      _id: id,
      _type: "frequentlyBoughtTogether",
      productId,
      relatedProductIds,
      updatedAt: new Date().toISOString(),
    },
  } : { delete: { id } };
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/mutate/${encodeURIComponent(dataset)}?returnIds=true`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [mutation] }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail ? `Storefront recommendation sync failed (${response.status}): ${detail}` : `Storefront recommendation sync failed (${response.status}).`);
  }
}

export async function syncStorefrontCollection(collection: StorefrontCollection) {
  const { projectId, dataset, token } = config();
  let image: { _type: "image"; asset: { _type: "reference"; _ref: string } } | undefined;
  if (collection.image) {
    const source = await fetch(collection.image, { cache: "no-store" });
    if (!source.ok) throw new Error(`Storefront image download failed (${source.status}).`);
    const asset = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/assets/images/${encodeURIComponent(dataset)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": source.headers.get("content-type") ?? "application/octet-stream" },
      body: await source.arrayBuffer(),
      cache: "no-store",
    });
    const assetBody = await asset.json() as { document?: { _id?: string }; message?: string };
    if (!asset.ok || !assetBody.document?._id) throw new Error(assetBody.message ? `Storefront image upload failed: ${assetBody.message}` : `Storefront image upload failed (${asset.status}).`);
    image = { _type: "image", asset: { _type: "reference", _ref: assetBody.document._id } };
  }
  const document = {
    _id: documentId(collection.id),
    _type: "productCollection",
    quitHeroCollectionId: collection.id,
    title: collection.name,
    slug: { _type: "slug", current: collection.slug },
    selectionMode: collection.type.toLowerCase(),
    ruleMatch: collection.match.toLowerCase(),
    productIds: collection.productIds ?? [],
    ...(image ? { image } : {}),
    ...(collection.type === "DYNAMIC" ? { dynamicRules: (collection.rules ?? []).map((rule, index) => ({ _key: `rule-${index}`, ...rule })) } : {}),
  };
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/mutate/${encodeURIComponent(dataset)}?returnIds=true`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ createOrReplace: document }] }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail ? `Storefront sync failed (${response.status}): ${detail}` : `Storefront sync failed (${response.status}).`);
  }
}

export async function deleteStorefrontCollection(retailCollectionId: string) {
  const { projectId, dataset, token } = config();
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/mutate/${encodeURIComponent(dataset)}?returnIds=true`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ delete: { id: documentId(retailCollectionId) } }] }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail ? `Storefront delete failed (${response.status}): ${detail}` : `Storefront delete failed (${response.status}).`);
  }
}
