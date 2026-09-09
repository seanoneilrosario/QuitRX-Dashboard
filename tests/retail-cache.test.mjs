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
    ["/products/123"], ["/customers"], ["/orders"], ["/product-variants"], ["/audit-logs"],
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
  assert.deepEqual(document, { _id: "retailCollection.collection-1", _type: "productCollection", retailCollectionId: "collection-1", title: "Quit Kits", slug: { _type: "slug", current: "quit-kits" }, selectionMode: "manual", ruleMatch: "all", productIds: ["product-2", "product-3"] });
});
