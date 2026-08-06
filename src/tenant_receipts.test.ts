import assert from "node:assert/strict";
import test from "node:test";
import { tenantBucket } from "./tenant_receipts.ts";

test("tenant bucket keeps receipt storage isolated by tenant", () => {
  assert.equal(tenantBucket("Acme Payments"), "ledger-acme-payments");
  assert.notEqual(tenantBucket("acme"), tenantBucket("bravo"));
});
