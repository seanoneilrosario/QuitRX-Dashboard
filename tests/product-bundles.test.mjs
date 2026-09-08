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
const component = { componentVariantId: "child", quantity: 2, position: 0 };

test("bundle validation rejects malformed data, same-slot duplicates, self references and invalid quantities", () => {
  for (const value of [null, {}, [null], [{ ...component, quantity: 0 }], [{ ...component, quantity: 1.5 }], [{ ...component, position: -1 }], [component, component], [{ ...component, componentVariantId: "parent" }]]) {
    assert.throws(() => validation.bundleComponents(value, "parent"));
  }
  assert.equal(validation.bundleComponents([], "parent").length, 0);
  assert.equal(validation.bundleComponents([component], "parent")[0].quantity, 2);
  assert.equal(validation.bundleComponents([component, { ...component, position: 1 }], "parent").length, 2);
});

test("bundle responses support API wrappers and empty bundles", () => {
  assert.equal(validation.bundleComponentResponse(null, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({ data: null }, "parent").length, 0);
  assert.equal(validation.bundleComponentResponse({ data: { components: [component] } }, "parent")[0].componentVariantId, "child");
  assert.equal(validation.bundleComponentResponse({ bundleComponents: [component] }, "parent")[0].quantity, 2);
  assert.throws(() => validation.bundleComponentResponse({}, "parent"));
});

test("bundle saves use the documented PATCH array with unique component positions", async () => {
  let staff = true;
  let fail = false;
  const calls = [];
  const actions = load("app/dashboard/bundle-actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: staff } }) },
    "@/lib/product-bundles": validation,
    "@/lib/quithero-admin": {
      retailRequest: async (path, options = {}) => { if (fail) throw new Error("API failed"); calls.push({ path, ...options }); return options.method === "PATCH" ? undefined : [component]; },
    },
  });
  const form = new FormData();
  form.set("productId", "product/1");
  form.set("variantId", "parent");
  form.set("components", JSON.stringify([component]));
  const previous = { message: "", success: false };
  assert.equal((await actions.saveBundle(previous, form)).success, true);
  assert.equal(calls[0].path, "/products/product%2F1/variants/parent/bundle");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].body), [component]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, calls[0].path);
  assert.equal(calls[1].method, undefined);
  calls.length = 0;
  const slots = [component, { ...component, componentVariantId: "child-2", position: 0 }];
  form.set("components", JSON.stringify(slots));
  assert.equal((await actions.saveBundle(previous, form)).success, true);
  assert.deepEqual(JSON.parse(calls[0].body), [slots[0], { ...slots[1], position: 1 }]);
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
