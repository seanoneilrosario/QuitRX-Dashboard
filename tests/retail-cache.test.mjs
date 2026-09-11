import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, require: (name) => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    }, ...globals,
  });
  return exports;
}

test("only catalog list reads use the short-lived cache", async () => {
  const calls = [];
  const api = load("lib/quithero-admin.ts", { "server-only": {} }, {
    process: { env: { QUITHERO_API_KEY: "test-key" } },
    fetch: async (url, options) => {
      calls.push(options);
      return { ok: true, text: async () => "{}" };
    },
  });
  for (const endpoint of ["/products?page=2&limit=100", "/products?tags=bundle&page=1&limit=100", "/brands", "/product-type", "/collections", "/tags", "/product-options"]) {
    await api.retailRequest(endpoint);
    const options = calls.at(-1);
    assert.equal(options.cache, "force-cache");
    assert.equal(options.next.revalidate, 30);
    assert.equal(options.next.tags[0], api.RETAIL_CATALOG_TAG);
  }
  for (const [endpoint, init] of [
    ["/products/123"], ["/customers"], ["/orders"], ["/audit-logs"],
    ["/products", { method: "POST" }], ["/products/123", { method: "PATCH" }],
    ["/products/123", { method: "DELETE" }], ["/products", { cache: "no-store" }],
  ]) {
    await api.retailRequest(endpoint, init);
    assert.equal(calls.at(-1).cache, "no-store");
    assert.equal(calls.at(-1).next, undefined);
  }
});

test("rate-limited reads and idempotent bundle saves are retried", async () => {
  const calls = [];
  const api = load("lib/quithero-admin.ts", { "server-only": {} }, {
    process: { env: { QUITHERO_API_KEY: "test-key" } },
    setTimeout: (callback) => callback(),
    fetch: async (_url, options) => {
      calls.push(options.method ?? "GET");
      const limited = calls.length === 1;
      return {
        ok: !limited,
        status: limited ? 429 : 200,
        headers: { get: () => "0" },
        text: async () => "{}",
      };
    },
  });
  await api.retailRequest("/products");
  assert.deepEqual(calls, ["GET", "GET"]);

  calls.length = 0;
  await api.retailRequest("/products/product/variants/variant/bundle", { method: "PATCH", body: "[]" });
  assert.deepEqual(calls, ["PATCH", "PATCH"]);
});

test("API errors include QuitHero validation details", async () => {
  const responses = [
    JSON.stringify({ message: ["componentVariantId must be a UUID", "quantity must be positive"] }),
    JSON.stringify({ error: "Bad Request" }),
    "Request could not be processed",
  ];
  const api = load("lib/quithero-admin.ts", { "server-only": {} }, {
    process: { env: { QUITHERO_API_KEY: "test-key" } },
    fetch: async () => ({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: async () => responses.shift(),
    }),
  });

  await assert.rejects(api.retailRequest("/products/123"), /400: componentVariantId must be a UUID quantity must be positive/);
  await assert.rejects(api.retailRequest("/products/123"), /400: Bad Request/);
  await assert.rejects(api.retailRequest("/products/123"), /400: Request could not be processed/);
});

test("successful saves and deletes expire the catalog; failed writes do not", async () => {
  const events = [];
  let fail = false;
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": {
      updateTag: (tag) => events.push(tag),
      revalidatePath: () => events.push("revalidate"),
    },
    "next/navigation": { redirect: () => events.push("redirect") },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      retailRequest: async () => { if (fail) throw new Error("API failed"); events.push("write"); },
    },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  });
  const form = new FormData();
  form.set("_resource", "products");
  form.set("_id", "123");
  for (const action of [actions.saveResource, actions.deleteResource]) {
    events.length = 0;
    await action(form);
    assert.deepEqual(events.slice(0, 3), ["write", "retail-catalog", "revalidate"]);
    fail = true;
    events.length = 0;
    await assert.rejects(action(form), /API failed/);
    assert.deepEqual(events, []);
    fail = false;
  }
});

test("deleting an already absent resource clears the stale catalog row", async () => {
  const events = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": {
      updateTag: (tag) => events.push(tag),
      revalidatePath: () => events.push("revalidate"),
    },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      retailRequest: async () => {
        throw new Error("QuitHero API returned 404: Product not found");
      },
    },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  }, { Error });
  const form = new FormData();
  form.set("_resource", "products");
  form.set("_id", "missing-product");

  await actions.deleteResource(form);

  assert.deepEqual(events, ["retail-catalog", "revalidate"]);
});

test("product creation recovers when QuitHero commits the product before returning 500", async () => {
  const events = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": {
      updateTag: (tag) => events.push(tag),
      revalidatePath: () => events.push("revalidate"),
    },
    "next/navigation": { redirect: (path) => events.push(`redirect ${path}`) },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      records: (payload) => payload.data,
      retailRequest: async (path, options) => {
        events.push(`${options.method ?? "GET"} ${path}`);
        if (options.method === "POST") throw new Error("QuitHero API returned 500: Internal server error");
        return path.includes("page=1")
          ? { data: [{ id: "other-product", slug: "other-product" }], pagination: { totalPages: 2 } }
          : { data: [{ id: "product-1", slug: "sample-product" }], pagination: { totalPages: 2 } };
      },
    },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  }, { Error });
  const form = new FormData();
  form.set("_resource", "products");
  form.set("_returnTo", "/dashboard/products");
  form.set("name", "SampleProduct");
  form.set("slug", "sample-product");

  await actions.saveResource(form);

  assert.deepEqual(events, [
    "POST /products",
    "GET /products?page=1&limit=100",
    "GET /products?page=2&limit=100",
    "retail-catalog",
    "revalidate",
    "redirect /dashboard/products",
  ]);
});

test("unsupported product-tag assignments do not turn a successful product save into an error", async () => {
  const events = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": {
      updateTag: (tag) => events.push(tag),
      revalidatePath: () => events.push("revalidate"),
    },
    "next/navigation": { redirect: (path) => events.push(`redirect ${path}`) },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      retailRequest: async (path) => {
        events.push(path);
        if (path === "/products") return { id: "product-1" };
        throw new Error(
          "QuitHero API returned 400: property productId should not exist property tagId should not exist",
        );
      },
    },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  }, { Error });
  const form = new FormData();
  form.set("_resource", "products");
  form.set("_returnTo", "/dashboard/products");
  form.set("name", "Tagged product");
  form.set("slug", "tagged-product");
  form.set("tags", "tag-1");
  form.set("_existingProductTags", "[]");

  await actions.saveResource(form);

  assert.deepEqual(events, [
    "/products",
    "/product-tags",
    "retail-catalog",
    "revalidate",
    "redirect /dashboard/products",
  ]);
});

test("product saves remove deselected tag relationships", async () => {
  const requests = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      retailRequest: async (path, options = {}) => {
        requests.push({ path, method: options.method ?? "GET", body: options.body });
        return { id: "product-1" };
      },
    },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  });
  const form = new FormData();
  form.set("_resource", "products");
  form.set("_id", "product-1");
  form.set("name", "Tagged product");
  form.set("slug", "tagged-product");
  form.set("tags", "tag-2");
  form.set("_existingProductTags", JSON.stringify([{ id: "relationship-1", tagId: "tag-1" }]));

  await actions.saveResource(form);

  assert.deepEqual(requests.map(({ path, method }) => `${method} ${path}`), [
    "PATCH /products/product-1",
    "DELETE /product-tags/relationship-1",
    "POST /product-tags",
  ]);
});

test("collection saves only fields supported by the retail API", async () => {
  let request;
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (path, options) => { request = { path, options }; } },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  });
  const form = new FormData();
  form.set("_resource", "collections");
  form.set("name", "Quit Kits");
  await actions.saveResource(form);
  assert.equal(request.path, "/collections");
  assert.deepEqual(JSON.parse(request.options.body), { name: "Quit Kits", slug: "quit-kits" });
});

test("manual and dynamic collection creation send structured API payloads", async () => {
  const requests = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (path, options) => { requests.push({ path, body: JSON.parse(options.body) }); return { id: `collection-${requests.length}` }; } },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  });

  const manual = new FormData();
  manual.set("name", "LULA Products");
  manual.set("slug", "lula-products");
  manual.set("description", "All LULA products");
  manual.set("type", "MANUAL");
  manual.set("match", "ALL");
  manual.set("productIds", JSON.stringify(["product-1", "product-2"]));
  manual.set("rules", "[]");
  manual.set("$ACTION_4:0", "framework-reference");
  manual.set("$ACTION_4:1", "framework-bound-args");
  manual.set("$ACTION_KEY", "framework-key");
  assert.equal((await actions.createCollection({}, manual)).success, true);
  assert.deepEqual(requests[0], { path: "/collections", body: { name: "LULA Products", slug: "lula-products", description: "All LULA products", type: "MANUAL", match: "ALL", productIds: ["product-1", "product-2"] } });

  const dynamic = new FormData();
  dynamic.set("name", "Bundle Products");
  dynamic.set("type", "DYNAMIC");
  dynamic.set("match", "ANY");
  dynamic.set("productIds", "[]");
  dynamic.set("rules", JSON.stringify([{ field: "tag", operator: "equals", value: "bundle" }, { field: "name", operator: "contains", value: "POD" }]));
  assert.equal((await actions.createCollection({}, dynamic)).success, true);
  assert.deepEqual(requests[1], { path: "/collections", body: { name: "Bundle Products", type: "DYNAMIC", match: "ANY", rules: [{ field: "tag", operator: "equals", value: "bundle" }, { field: "name", operator: "contains", value: "POD" }], slug: "bundle-products" } });
});

test("collection creation returns validation and API errors", async () => {
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async () => { throw new Error("API rejected collection"); } },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  }, { Error });
  const invalid = new FormData();
  invalid.set("name", "Empty manual"); invalid.set("type", "MANUAL"); invalid.set("match", "ALL"); invalid.set("productIds", "[]"); invalid.set("rules", "[]");
  assert.match((await actions.createCollection({}, invalid)).message, /Select at least one product/);
  invalid.set("productIds", "[\"product-1\"]");
  assert.match((await actions.createCollection({}, invalid)).message, /API rejected collection/);
});

test("editing a manual collection patches its updated product IDs", async () => {
  let request;
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (path, options) => { request = { path, method: options.method, body: JSON.parse(options.body) }; } },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {} },
  });
  const form = new FormData();
  form.set("_id", "collection-1"); form.set("name", "Quit Kits"); form.set("slug", "quit-kits"); form.set("type", "MANUAL"); form.set("match", "ALL"); form.set("productIds", JSON.stringify(["product-2", "product-3"])); form.set("rules", "[]");
  assert.equal((await actions.createCollection({}, form)).success, true);
  assert.deepEqual(request, { path: "/collections/collection-1", method: "PATCH", body: { name: "Quit Kits", slug: "quit-kits", type: "MANUAL", match: "ALL", productIds: ["product-2", "product-3"] } });

  form.set("productIds", "[]");
  assert.equal((await actions.createCollection({}, form)).success, true);
  assert.deepEqual(request.body.productIds, []);
});

test("storefront collection sync writes the Sanity productCollection shape", async () => {
  let request;
  const storefront = load("lib/sanity-storefront.ts", { "server-only": {} }, {
    process: { env: { NEXT_PUBLIC_SANITY_PROJECT_ID: "project", NEXT_PUBLIC_SANITY_DATASET: "production", SANITY_WRITE_TOKEN: "write-token" } },
    fetch: async (url, options) => { request = { url, options }; return { ok: true, text: async () => "" }; },
  });
  await storefront.syncStorefrontCollection({ id: "collection-1", name: "Quit Kits", slug: "quit-kits", type: "MANUAL", match: "ALL", productIds: ["product-2", "product-3"] });
  const document = JSON.parse(request.options.body).mutations[0].createOrReplace;
  assert.equal(request.url, "https://project.api.sanity.io/v2026-09-09/data/mutate/production?returnIds=true");
  assert.equal(request.options.headers.authorization, "Bearer write-token");
  assert.deepEqual(document, { _id: "retailCollection.collection-1", _type: "productCollection", quitHeroCollectionId: "collection-1", title: "Quit Kits", slug: { _type: "slug", current: "quit-kits" }, selectionMode: "manual", ruleMatch: "all", productIds: ["product-2", "product-3"] });
});

test("collection deletion detaches products, deletes Retail collection, then removes storefront document", async () => {
  const events = [];
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => events.push("cache"), revalidatePath: () => events.push("revalidate") },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (path, options) => events.push(`${options.method} ${path}`) },
    "@/lib/sanity-storefront": { syncStorefrontCollection: async () => {}, deleteStorefrontCollection: async (id) => events.push(`storefront ${id}`) },
  });
  const form = new FormData(); form.set("_id", "collection-1");
  assert.equal((await actions.deleteCollection({}, form)).success, true);
  assert.deepEqual(events, ["PATCH /collections/collection-1", "DELETE /collections/collection-1", "cache", "revalidate", "storefront collection-1"]);
});

test("collection editor uses product IDs instead of collection relationship IDs", () => {
  const { collectionProductIds } = load("lib/collection-products.ts", {});
  assert.deepEqual(collectionProductIds({ products: [
    { id: "relationship-1", productId: "product-1", collectionId: "collection-1", product: { id: "product-1" } },
    { id: "relationship-2", collectionId: "collection-1", product: { id: "product-2" } },
    { id: "product-3", name: "Direct product" },
  ] }), ["product-1", "product-2", "product-3"]);
});

test("dynamic collection rules match normalized tags with ALL and ANY logic", () => {
  const { dynamicCollectionProductIds } = load("lib/collection-products.ts", {});
  const products = [
    { id: "mint", name: "Mint Pod", slug: "mint-pod", brand: "Acme", tags: ["Bundle", "Mint"] },
    { id: "berry", name: "Berry Pod", slug: "berry-pod", brand: "Acme", tags: ["Bundle", "Berry"] },
  ];
  assert.deepEqual(dynamicCollectionProductIds(products, [{ field: "tag", operator: "equals", value: "bundle" }, { field: "tag", operator: "equals", value: "mint" }], "ALL"), ["mint"]);
  assert.deepEqual(dynamicCollectionProductIds(products, [{ field: "tag", operator: "equals", value: "mint" }, { field: "name", operator: "contains", value: "berry" }], "ANY"), ["mint", "berry"]);
});

test("frequently bought together recommendations are read and saved in order", async () => {
  const requests = [];
  const storefront = load("lib/sanity-storefront.ts", { "server-only": {} }, {
    process: { env: { NEXT_PUBLIC_SANITY_PROJECT_ID: "project", NEXT_PUBLIC_SANITY_DATASET: "production", SANITY_WRITE_TOKEN: "write-token" } },
    URLSearchParams,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      return options.method === "POST"
        ? { ok: true, text: async () => "" }
        : { ok: true, json: async () => ({ result: ["related-2", "related-1"] }) };
    },
  });

  assert.deepEqual(await storefront.getFrequentlyBoughtTogether("product-1"), ["related-2", "related-1"]);
  await storefront.syncFrequentlyBoughtTogether("product-1", ["related-2", "related-1"]);
  const document = JSON.parse(requests[1].options.body).mutations[0].createOrReplace;
  assert.equal(document._id, "frequentlyBoughtTogether.product-1");
  assert.equal(document._type, "frequentlyBoughtTogether");
  assert.deepEqual(document.relatedProductIds, ["related-2", "related-1"]);
});
