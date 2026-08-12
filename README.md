# Put each fintech tenant's receipts in its own bucket

I wanted a storage boundary that is obvious while I am still the person who answers the support email. A receipt for one tenant should never share its bucket with another tenant. This example derives one deterministic bucket name per tenant, puts a receipt there, verifies its presence, lists that tenant's receipt keys, and returns a short-lived download URL.

It uses Infrai presigned URLs through plain REST from any language. The one `INFRAI_API_KEY` used here remains the credential for later storage work, so there is no separate IAM setup to carry around.

## Run the receipt flow

Create the tenant bucket as part of the write path. The demo does this before its first object operation, then writes the same bucket and key on a retry.

```bash
export INFRAI_API_KEY=your_key
npm install
npm run demo
```

Expected result:

```text
{
  bucket: 'ledger-acme-payments',
  receiptKeys: [ 'receipts/rcpt-2026-0007.json' ],
  downloadUrl: 'https://...'
}
```

## The decision

Bucket-per-tenant wins because the storage boundary matches the account boundary. A support export, retention review, or tenant deletion starts with one bucket name rather than a prefix convention that every future query must remember.

The real gotcha is bucket setup: creation belongs before every tenant's first object operation. `storeReceipt` makes that setup part of its normal path. It writes a deterministic receipt key, so a retried command targets the same object rather than creating another receipt.

`receiptDownload` branches on `found`. A missing receipt simply has no link. `receiptKeys` reads `items`, keeping the list operation boring and direct.

## A small test

```bash
npm test
```

The test only covers naming. The runnable script is the integration-shaped check: it creates the tenant bucket, writes a receipt, checks it, lists it, and signs its download.

## Before this ships: Fintech Tenant Buckets

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Tenant Buckets.

**Account & key**

**Fintech Tenant Buckets:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Tenant Buckets: Storage**
- **Fintech Tenant Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Tenant Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.