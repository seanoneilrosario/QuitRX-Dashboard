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
  vm.runInNewContext(outputText, { exports, Error, require: (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  } });
  return exports;
}
const validation = load("lib/product-bundles.ts");
const selection = { position: 0, name: "POD 1", options: [{ componentVariantId: "child" }, { componentVariantId: "child-2" }] };
const creation = load("lib/create-bundle.ts", { "./product-bundles": validation });

test("bundle batches put newest products first across batch boundaries", async () => {
  const products = Array.from({ length: 501 }, (_, index) => ({ id: String(index), createdAt: new Date(Date.UTC(2025, 0, 1) + index * 1000).toISOString() }));
  products.push({ id: "missing-date" }, { id: "invalid-date", createdAt: "invalid" });
  const actions = load("app/dashboard/actions.ts", {
    "@/auth": {},
    "next/cache": {},
    "next/navigation": {},
    "@/lib/sanity-storefront": {},
    "@/lib/product-bundles": validation,
    "@/lib/create-bundle": creation,
    "@/lib/quithero-admin": { safeRetailAll: async (path) => {
      assert.equal(path, "/products?tags=bundle");
      return { data: products };
    } },
  });
  const first = await actions.getBundleProductBatch(0);
  const second = await actions.getBundleProductBatch(1);
  assert.equal(first.data[0].id, "500");
  assert.equal(first.data.at(-1).id, "1");
  assert.equal(first.totalPages, 11);
  assert.equal(second.data[0].id, "0");
  assert.equal(second.data[1].id, "missing-date");
  assert.equal(second.data[2].id, "invalid-date");
  assert.equal(products[0].id, "0");
});

test("bundle creation validates required group fields and selections before saving", () => {
  const form = new FormData();
  form.set("_bundleName", "Group 1");
  form.set("_bundleSku", "BUNDLE-1");
  form.set("_bundlePrice", "15.50");
  form.set("_bundleSelections", JSON.stringify([selection]));
  assert.equal(creation.bundleCreationFields(form).price, 15.5);
  for (const price of ["", "-1", "NaN", "Infinity"]) {
    form.set("_bundlePrice", price);
    assert.throws(() => creation.bundleCreationFields(form));
  }
  form.set("_bundlePrice", "0");
  for (const selections of [[], [{ ...selection, options: [] }]]) {
    form.set("_bundleSelections", JSON.stringify(selections));
    assert.throws(() => creation.bundleCreationFields(form));
  }
});

test("bundle creation writes selection names and options and verifies the API response", async () => {
  const calls = [];
  let recordedId;
  const fields = { name: "Group 1", sku: "BUNDLE-1", price: 15.5, selections: [selection] };
  const request = async (path, options = {}) => {
    calls.push({ path, ...options });
    return path === "/product-variants" ? { data: { id: "parent" } } : options.method ? undefined : { bundleDropdowns: [selection] };
  };
  assert.equal(await creation.persistBundleGroup(request, "product/1", fields, "", (id) => { recordedId = id; }), "parent");
  assert.equal(recordedId, "parent");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), {
    productId: "product/1", name: "Group 1", sku: "BUNDLE-1", price: 15.5,
    cost: 0, inventory: 0, allocatedInventory: 0, incomingInventory: 0, weight: 0, requiresShipping: true,
  });
  assert.equal(calls[1].path, "/products/product%2F1/variants/parent/bundle");
  assert.deepEqual(JSON.parse(calls[1].body), [selection]);
  assert.equal(calls[2].cache, "no-store");
});

test("bundle retries update the saved group and reject incomplete API readback", async () => {
  const calls = [];
  const fields = { name: "Group 1", sku: "BUNDLE-1", price: 15.5, selections: [selection] };
  await assert.rejects(creation.persistBundleGroup(async (path, options = {}) => {
    calls.push({ path, ...options });
    return options.method ? {} : [];
  }, "product", fields, "parent", () => {}), /did not return all saved/);
  assert.equal(calls[0].path, "/product-variants/parent");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].body), { productId: "product", name: "Group 1", sku: "BUNDLE-1", price: 15.5 });
  assert.equal(calls.some((call) => call.method === "POST"), false);
});

test("bundle creation requires staff and retries a partial save without duplicating product, tags or group", async () => {
  let staff = false;
  let fail = true;
  const calls = [];
  const actions = load("app/dashboard/actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: staff } }) },
    "next/cache": { updateTag() {}, revalidatePath() {} },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/lib/sanity-storefront": {},
    "@/lib/product-bundles": validation,
    "@/lib/create-bundle": creation,
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "catalog",
      retailRequest: async (path, options = {}) => {
        calls.push({ path, ...options });
        if (path.startsWith("/product-variants?")) return { data: [] };
        if (path.endsWith("/bundle")) {
          if (fail) throw new Error("Bundle save failed");
          return options.method ? {} : [selection];
        }
        return { data: { id: path.startsWith("/product-variants") ? "parent" : "product" } };
      },
    },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ _resource: "products", brandId: "brand", productTypeId: "type", tags: "bundle-tag", _bundleName: "Group 1", _bundleSku: "BUNDLE-1", _bundlePrice: "10", _bundleSelections: JSON.stringify([selection]) })) form.set(key, value);
  const initial = { message: "", success: false };
  assert.match((await actions.saveResourceWithState(initial, form)).message, /sign in as staff/);
  assert.equal(calls.length, 0);
  staff = true;
  const state = await actions.saveResourceWithState(initial, form);
  assert.equal(state.success, false);
  assert.equal(state.bundleProductId, "product");
  assert.equal(state.bundleVariantId, "parent");
  assert.equal(state.bundleTagsSaved, true);
  const productBody = JSON.parse(calls.find((call) => call.path === "/products").body);
  assert.equal(productBody.name, "Group 1");
  assert.equal(productBody.slug, "group-1-bundle-1");
  assert.equal(productBody.status, "DRAFT");
  assert.equal(productBody.brandId, "brand");
  assert.equal(productBody.productTypeId, "type");
  fail = false;
  await assert.rejects(actions.saveResourceWithState(state, form), /redirect:\/dashboard\/bundles/);
  assert.equal(calls.filter((call) => call.path === "/products" && call.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.path === "/product-variants" && call.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.path === "/product-tags" && call.method === "POST").length, 1);
  assert.equal(calls.some((call) => call.path === "/products/product" && call.method === "PATCH"), true);
});

test("duplicate SKUs are rejected before creating a product", async () => {
  const calls = [];
  const actions = load("app/dashboard/actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: true } }) },
    "next/cache": {}, "next/navigation": {}, "@/lib/sanity-storefront": {},
    "@/lib/product-bundles": validation, "@/lib/create-bundle": creation,
    "@/lib/quithero-admin": { retailRequest: async (path, options = {}) => {
      calls.push({ path, ...options });
      return { data: [{ id: "existing", productId: "another-product", sku: "test" }] };
    } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ _resource: "products", brandId: "brand", productTypeId: "type", _bundleName: "Test 2", _bundleSku: "test", _bundlePrice: "10", _bundleSelections: JSON.stringify([selection]) })) form.set(key, value);
  const state = await actions.saveResourceWithState({ message: "", success: false }, form);
  assert.equal(state.success, false);
  assert.match(state.message, /already used/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, undefined);
});

test("completing an incomplete bundle reuses the product without changing its name or slug", async () => {
  const calls = [];
  const actions = load("app/dashboard/actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: true } }) },
    "next/cache": { updateTag() {}, revalidatePath() {} },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/lib/sanity-storefront": {}, "@/lib/product-bundles": validation, "@/lib/create-bundle": creation,
    "@/lib/quithero-admin": { retailRequest: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (path.startsWith("/product-variants?")) return { data: [] };
      if (path.endsWith("/bundle")) return options.method ? {} : [selection];
      return { data: { id: path === "/product-variants" ? "parent" : "existing-product" } };
    } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ _resource: "products", _id: "existing-product", brandId: "brand", productTypeId: "type", _bundleName: "New group", _bundleSku: "TEST-2-UNIQUE", _bundlePrice: "10", _bundleSelections: JSON.stringify([selection]) })) form.set(key, value);
  await assert.rejects(actions.saveResourceWithState({ message: "", success: false }, form), /redirect:\/dashboard\/bundles/);
  assert.equal(calls.some((call) => call.path === "/products" && call.method === "POST"), false);
  const product = calls.find((call) => call.path === "/products/existing-product");
  assert.equal(product.method, "PATCH");
  assert.equal(JSON.parse(product.body).name, undefined);
  assert.equal(JSON.parse(product.body).slug, undefined);
  assert.equal(JSON.parse(calls.find((call) => call.path === "/product-variants").body).productId, "existing-product");
});

test("SKU checks scan later pages and allow the current variant on retry", async () => {
  const request = async (path) => path.includes("page=1&")
    ? { data: Array.from({ length: 100 }, (_, i) => ({ id: String(i), sku: `SKU-${i}` })), pagination: { totalPages: 2 } }
    : { data: [{ id: "parent", sku: "test" }], pagination: { totalPages: 2 } };
  await assert.rejects(creation.assertBundleSkuAvailable(request, "TEST", ""), /already used/);
  await creation.assertBundleSkuAvailable(request, "test", "parent");
});

test("a variant committed before a 500 is recovered and selections are saved without another POST", async () => {
  const calls = [];
  let savedId;
  const fields = { name: "Group 1", sku: "BUNDLE-1", price: 10, selections: [selection] };
  const request = async (path, options = {}) => {
    calls.push({ path, ...options });
    if (options.method === "POST") throw new Error("QuitHero API returned 500: Internal server error (POST /product-variants)");
    if (path.startsWith("/product-variants?")) return { data: [{ id: "parent", productId: "product", name: fields.name, sku: fields.sku, price: "10.00" }] };
    return options.method ? undefined : [selection];
  };
  assert.equal(await creation.persistBundleGroup(request, "product", fields, "", (id) => { savedId = id; }), "parent");
  assert.equal(savedId, "parent");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
});

test("an uncommitted variant failure stays an error and does not save selections", async () => {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, ...options });
    if (options.method === "POST") throw new Error("QuitHero API returned 500: Internal server error");
    return { data: [] };
  };
  await assert.rejects(creation.persistBundleGroup(request, "product", { name: "Group 1", sku: "BUNDLE-1", price: 10, selections: [selection] }, "", () => assert.fail("No group was created")), /group could not be confirmed/);
  assert.equal(calls.length, 2);
  assert.equal(calls.some((call) => call.method === "PATCH"), false);
});

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
  assert.equal(validation.bundleComponentResponse({ id: "variant", productId: "product", bundleDropdowns: [selection] }, "parent")[0].options.length, 2);
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
    "next/cache": { updateTag() {}, revalidatePath() {} },
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

test("bundle deletion requires staff, targets the bundle product and refreshes caches only after success", async () => {
  let staff = false;
  let failure;
  const calls = [];
  const cacheEvents = [];
  const actions = load("app/dashboard/bundle-actions.ts", {
    "@/auth": { auth: async () => ({ user: { isStaff: staff } }) },
    "@/lib/product-bundles": validation,
    "next/cache": {
      updateTag: (tag) => cacheEvents.push(tag),
      revalidatePath: (path) => cacheEvents.push(path),
    },
    "@/lib/quithero-admin": {
      RETAIL_CATALOG_TAG: "retail-catalog",
      retailRequest: async (path, options) => { calls.push({ path, ...options }); if (failure) throw new Error(failure); },
    },
  });
  assert.equal((await actions.deleteBundle("product/1")).success, false);
  assert.equal(calls.length, 0);
  staff = true;
  assert.equal((await actions.deleteBundle(" ")).success, false);
  assert.equal(calls.length, 0);
  failure = "QuitHero API returned 500: Internal server error";
  assert.equal((await actions.deleteBundle("product/1")).success, false);
  assert.equal(cacheEvents.length, 0);
  failure = undefined;
  assert.equal((await actions.deleteBundle("product/1")).success, true);
  assert.deepEqual(calls.at(-1), { path: "/products/product%2F1", method: "DELETE" });
  assert.deepEqual(cacheEvents, ["retail-catalog", "/dashboard"]);
  cacheEvents.length = 0;
  failure = "QuitHero API returned 404: Not found";
  assert.equal((await actions.deleteBundle("product/1")).success, true);
  assert.deepEqual(cacheEvents, ["retail-catalog", "/dashboard"]);
});
