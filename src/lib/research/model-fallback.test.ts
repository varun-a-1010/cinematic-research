import { test } from "node:test";
import assert from "node:assert/strict";
import { modelChain, withModelFallback } from "./model-fallback.ts";

test("retries primary then switches on transient failures", async () => {
  const calls: string[] = [];
  const result = await withModelFallback(["primary", "backup"], async model => {
    calls.push(model);
    if (model === "primary") throw { status: 429 };
    return "ok";
  }, async () => {});
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["primary", "primary", "backup"]);
});
test("does not retry auth or validation failures", async () => {
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    await assert.rejects(withModelFallback(["a", "b"], async () => {
      calls++; throw Object.assign(new Error("request failed"), { status });
    }));
    assert.equal(calls, 1);
  }
});
test("bounded exhaustion and deduplication", async () => {
  let calls = 0;
  await assert.rejects(withModelFallback(["a", "b"], async () => {
    calls++; throw { status: 503 };
  }, async () => {}));
  assert.equal(calls, 4);
  assert.deepEqual(modelChain("a", "a,b,b"), ["a", "b"]);
});
