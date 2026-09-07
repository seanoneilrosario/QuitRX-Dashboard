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
  for (const endpoint of ["/products?page=2&limit=100", "/brands", "/product-type", "/collections", "/tags", "/product-options"]) {
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
