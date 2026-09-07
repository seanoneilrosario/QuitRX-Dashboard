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

test("collection saves serialize selected product IDs", async () => {
  let request;
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (path, options) => { request = { path, options }; } },
  });
  const form = new FormData();
  form.set("_resource", "collections");
  form.set("name", "Quit Kits");
  form.set("productIds", JSON.stringify(["product-1", "product-2", "product-1"]));
  await actions.saveResource(form);
  assert.equal(request.path, "/collections");
  assert.deepEqual(JSON.parse(request.options.body).productIds, ["product-1", "product-2"]);
});

test("dynamic collections save a tag condition and current matching products", async () => {
  let request;
  const actions = load("app/dashboard/actions.ts", {
    "next/cache": { updateTag: () => {}, revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/quithero-admin": { RETAIL_CATALOG_TAG: "retail-catalog", retailRequest: async (_path, options) => { request = options; } },
  });
  const form = new FormData();
  form.set("_resource", "collections");
  form.set("name", "Test products");
  form.set("selectionMode", "dynamic");
  form.set("ruleMatch", "all");
  form.set("dynamicRules", JSON.stringify([{ field: "tag", operator: "equals", value: "test" }]));
  form.set("productIds", JSON.stringify(["product-1"]));
  await actions.saveResource(form);
  const body = JSON.parse(request.body);
  assert.equal(body.selectionMode, "dynamic");
  assert.equal(body.dynamicRules[0].value, "test");
  assert.deepEqual(body.productIds, ["product-1"]);
});
