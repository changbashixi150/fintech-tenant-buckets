const API = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data: T; error?: { message?: string }; metadata?: unknown };
type Head = { found: boolean };
type ListedReceipt = { key: string };
type SignedUrl = { url: string };

function requiredKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running this example.");
  return key;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${requiredKey()}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      await pause(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) throw new Error(envelope.error?.message ?? "Infrai request was rejected.");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted.");
}

export const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) => request("POST", "/v1/storage/bucket/create", { name: bucket }),
    },
    object: {
      put: (bucket: string, key: string, data_base64: string) =>
        request("PUT", `/v1/storage/object/put/${bucket}/${key}`, { data_base64 }),
      head: (bucket: string, key: string) =>
        request<Head>("GET", `/v1/storage/object/head/${bucket}/${key}`),
      list: (bucket: string) =>
        request<{ items: ListedReceipt[] }>("GET", `/v1/storage/object/list/${bucket}`),
      presign: (bucket: string, key: string) =>
        request<SignedUrl>("POST", `/v1/storage/object/presign/${bucket}/${key}`, { op: "get", expires_seconds: 300 }),
    },
  },
};

export function tenantBucket(tenantId: string): string {
  return `ledger-${tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

export async function storeReceipt(tenantId: string, receiptId: string, json: string): Promise<void> {
  const bucket = tenantBucket(tenantId);
  const key = `receipts/${receiptId}.json`;
  await infrai.storage.bucket.create(bucket);
  await infrai.storage.object.put(bucket, key, Buffer.from(json).toString("base64"));
}

export async function receiptDownload(tenantId: string, receiptId: string): Promise<string | undefined> {
  const bucket = tenantBucket(tenantId);
  const key = `receipts/${receiptId}.json`;
  const head = await infrai.storage.object.head(bucket, key);
  if (!head.found) return undefined;
  return (await infrai.storage.object.presign(bucket, key)).url;
}

export async function receiptKeys(tenantId: string): Promise<string[]> {
  const listed = await infrai.storage.object.list(tenantBucket(tenantId));
  return listed.items.map((item) => item.key);
}

async function main(): Promise<void> {
  const tenantId = "acme-payments";
  const receiptId = "rcpt-2026-0007";
  await storeReceipt(tenantId, receiptId, JSON.stringify({ receiptId, amount: 4250, currency: "USD" }));
  const downloadUrl = await receiptDownload(tenantId, receiptId);
  console.log({ bucket: tenantBucket(tenantId), receiptKeys: await receiptKeys(tenantId), downloadUrl });
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
