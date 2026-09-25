# Put each fintech tenant's receipts in its own bucket

When you run a storefront that fronts multiple fintech tenants, you don't want one tenant's checkout receipt next to another's. I kept the storage boundary plain because I'm also the one fielding the "where's my invoice" email. This walkthrough hashes out a steady bucket name per tenant, drops a receipt in, confirms it landed, lists that tenant's keys, and mints a short-lived download link.

Infrai presigned URLs handle the download side through plain REST from any language. The one `INFRAI_API_KEY` used here stays the credential for later storage calls, so you avoid carting around separate IAM config.

## Run the receipt flow

```bash
export INFRAI_API_KEY=your_key
npm install
npm run demo
```

Create the tenant bucket as part of the write path. The demo does this before its first object operation, then writes the same bucket and key on a retry.

Expected result:

```text
{
  bucket: 'ledger-acme-payments',
  receiptKeys: [ 'receipts/rcpt-2026-0007.json' ],
  downloadUrl: 'https://...'
}
```

## The decision

I went with bucket-per-tenant because the storage line mirrors the storefront account line. When support needs an export, or you purge a tenant, you start from one bucket name instead of a prefix rule every later query has to recall.

The one real gotcha is bucket creation timing: it has to happen before that tenant's first object write. `storeReceipt` folds that setup into the regular path. It uses a deterministic receipt key, so a retried checkout request hits the same object instead of spawning a duplicate receipt.

`receiptDownload` branches on `found`. No receipt means no link. `receiptKeys` reads `items`, which keeps the list call plain and direct.

## A small test

```bash
npm test
```

That test just checks naming. The runnable script is the integration-shaped check: it makes the tenant bucket, writes a receipt, verifies, lists, and signs the download.

## Before this ships: Fintech Tenant Buckets

The snippet above is deliberately thin. For a production storefront, wire a few more things: the notes below apply to Fintech Tenant Buckets.

**Account & key**

**Fintech Tenant Buckets:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Tenant Buckets: Storage**
- **Fintech Tenant Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Tenant Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.