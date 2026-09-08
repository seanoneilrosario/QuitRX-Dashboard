import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, mocks = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  } });
  return exports;
}
const validation = load("lib/product-bundles.ts");
const selection = { position: 0, name: "POD 1", options: [{ componentVariantId: "child" }, { componentVariantId: "child-2" }] };

test("bundle validation accepts multiple options and rejects malformed selections", () => {
  for (const value of [null, {}, [null], [{ ...selection, options: [] }], [{ ...selection, position: -1 }], [selection, selection], [{ ...selection, options: [{ componentVariantId: "parent" }] }], [{ ...selection, options: [{ componentVariantId: "child" }, { componentVariantId: "child" }] }]]) {
    assert.throws(() => validation.bundleComponents(value, "parent"));
  }
  assert.equal(validation.bundleComponents([], "parent").length, 0);
  assert.equal(validation.bundleComponents([selection], "parent")[0].options.length, 2);
  assert.equal(validation.bundleComponents([selection, { ...selection, position: 1 }], "parent").length, 2);
});

test("bundle responses support API wrappers and empty bundles", () => {
  assert.equal(validation.bundleComponentResponse(null, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({}, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({ data: null }, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({ data: {} }, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({ bundle: [selection] }, "parent")[0].options.length, 2);
  assert.equal(validation.bundleComponentResponse({ selections: [selection] }, "parent")[0].options.length, 2);
  assert.equal(validation.bundleComponentResponse({ data: { bundleSelections: [selection] } }, "parent")[0].options.length, 2);
  assert.equal(validation.bundleComponentResponse({ data: { components: [selection] } }, "parent")[0].options[0].componentVariantId, "child");
  assert.equal(validation.bundleComponentResponse({ bundleComponents: [selection] }, "parent")[0].options.length, 2);
  assert.equal(validation.bundleComponentResponse([{ componentVariantId: "legacy-child", quantity: 1, position: 0 }], "parent")[0].options[0].componentVariantId, "legacy-child");
  assert.throws(() => validation.bundleComponentResponse({ unexpected: true }, "parent"));
});

test("bundle saves multiple variant options per uniquely positioned selection", async () => {
  let staff = true;
  let fail = false;
  const calls = [];
  const actions = load("app/dashboard/bundle-actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: staff } }) },
    "@/lib/product-bundles": validation,
    "@/lib/quithero-admin": {
      retailRequest: async (path, options = {}) => { if (fail) throw new Error("API failed"); calls.push({ path, ...options }); return options.method === "PATCH" ? undefined : [selection]; },
    },
  });
  const form = new FormData();
  form.set("productId", "product/1");
  form.set("variantId", "parent");
  form.set("components", JSON.stringify([selection]));
  const previous = { message: "", success: false };
  assert.equal((await actions.saveBundle(previous, form)).success, true);
  assert.equal(calls[0].path, "/products/product%2F1/variants/parent/bundle");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].body), [selection]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, calls[0].path);
  assert.equal(calls[1].method, undefined);
  calls.length = 0;
  const slots = [selection, { ...selection, position: 0 }];
  form.set("components", JSON.stringify(slots));
  assert.equal((await actions.saveBundle(previous, form)).success, false);
  assert.equal(calls.length, 0);
  calls.length = 0;
  form.set("components", "[]");
  assert.equal((await actions.saveBundle(previous, form)).success, true);
  assert.equal(calls[0].body, "[]");
  calls.length = 0;
  fail = true;
  assert.equal((await actions.saveBundle(previous, form)).success, false);
  assert.equal(calls.length, 0);
  fail = false;
  staff = false;
  assert.equal((await actions.saveBundle(previous, form)).success, false);
  assert.equal(calls.length, 0);
});
