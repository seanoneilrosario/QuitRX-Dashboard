import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup({ staff = true, fail = false } = {}) {
  const calls = [];
  const revalidated = [];
  const exports = {};
  const mocks = {
    "@/auth": { auth: async () => ({ user: { isStaff: staff } }) },
    "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
    "next/navigation": {
      redirect: (path) => {
        throw new Error(`redirect:${path}`);
      },
    },
    "@/lib/quithero-admin": {
      retailRequest: async (path, init) => {
        calls.push({ path, ...init, body: init.body ? JSON.parse(init.body) : undefined });
        if (fail) throw new Error("QuitHero API returned 500: Internal server error");
        if (init.method === "DELETE") return undefined;
        return { data: { id: "customer-1" } };
      },
    },
  };
  const source = fs.readFileSync(
    new URL("../app/dashboard/customer-actions.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { exports, require: (name) => mocks[name], Error });
  return {
    calls,
    revalidated,
    deleteCustomer: (id) => exports.deleteCustomer({ message: "" }, new Map([["customerId", id]])),
    submit: (values) =>
      exports.createCustomer(
        { message: "" },
        new Map(Object.entries({ email: "test@example.com", ...values })),
      ),
  };
}

test("creation sends ISO dates and retains tags and typed metafields", async () => {
  const { calls, submit } = setup();
  await assert.rejects(
    submit({
      birthday: "2000-06-02",
      scriptExpiry: "2026-08-16",
      tags: " Script, ScriptACTIVE, Script ",
      scriptActive: "true",
      consultPurchase: "false",
      scriptId: " abc ",
    }),
    /redirect:/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body.birthday, "2000-06-02T00:00:00.000Z");
  assert.equal(calls[0].body.scriptExpiry, "2026-08-16T00:00:00.000Z");
  assert.deepEqual(calls[0].body.tags, ["Script", "ScriptACTIVE"]);
  assert.equal(calls[0].body.scriptActive, true);
  assert.equal(calls[0].body.consultPurchase, false);
  assert.equal(calls[0].body.scriptId, "abc");
});

test("deletion encodes the ID, accepts an empty response and refreshes before redirecting", async () => {
  const { calls, revalidated, deleteCustomer } = setup();
  await assert.rejects(deleteCustomer("customer/1?x"), /^Error: redirect:\/dashboard\/customers$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/customers/customer%2F1%3Fx");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].body, undefined);
  assert.equal(revalidated[0][0], "/dashboard");
  assert.equal(revalidated[0][1], "layout");
});

test("deletion rejects unauthorized users and missing IDs without calling the API", async () => {
  const unauthorized = setup({ staff: false });
  assert.match((await unauthorized.deleteCustomer("customer-1")).message, /signed in as staff/);
  assert.equal(unauthorized.calls.length, 0);
  const authorized = setup();
  for (const id of [undefined, "", "   ", {}]) {
    assert.match((await authorized.deleteCustomer(id)).message, /Customer ID is required/);
  }
  assert.equal(authorized.calls.length, 0);
});

test("failed deletion shows the API error without redirecting or refreshing", async () => {
  const { calls, revalidated, deleteCustomer } = setup({ fail: true });
  assert.match((await deleteCustomer("customer-1")).message, /500/);
  assert.equal(calls.length, 1);
  assert.equal(revalidated.length, 0);
});

test("blank dates are omitted and invalid dates never reach the API", async () => {
  const { calls, submit } = setup();
  await assert.rejects(submit({ birthday: "", scriptExpiry: "" }), /redirect:/);
  assert.equal("birthday" in calls[0].body, false);
  assert.equal("scriptExpiry" in calls[0].body, false);
  for (const birthday of ["2026-02-30", "invalid", "2026-13-01"]) {
    const result = await submit({ birthday });
    assert.match(result.message, /Birthday must be a valid date/);
  }
  assert.equal(calls.length, 1);
});

test("staff authorization is required and failed creates are not retried", async () => {
  const unauthorized = setup({ staff: false });
  assert.match((await unauthorized.submit({})).message, /signed in as staff/);
  assert.equal(unauthorized.calls.length, 0);
  const failed = setup({ fail: true });
  assert.match((await failed.submit({})).message, /500/);
  assert.equal(failed.calls.length, 1);
});
