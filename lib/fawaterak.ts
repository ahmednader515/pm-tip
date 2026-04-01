import crypto from "crypto";

const DEFAULT_BASE_URL = "https://staging.fawaterk.com/api/v2";

export type FawaterakMethodKind = "cards" | "wallets" | "fawry";

export interface FawaterakPaymentMethod {
  paymentId: number;
  name_en: string;
  name_ar: string;
  redirect: string;
  logo?: string;
}

interface FawaterakApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

interface FawaterakInitPayResponseData {
  invoice_id: number;
  invoice_key: string;
  payment_data?: Record<string, unknown>;
}

interface FawaterakInvoiceLinkResponseData {
  url: string;
  invoiceKey: string;
  invoiceId: number;
}

function getBaseUrl() {
  return process.env.FAWATERAK_BASE_URL || DEFAULT_BASE_URL;
}

function getApiToken() {
  const token = process.env.FAWATERAK_API_TOKEN;
  if (!token) {
    throw new Error("Missing FAWATERAK_API_TOKEN");
  }
  return token;
}

function getVendorKey() {
  const key = process.env.FAWATERAK_VENDOR_KEY;
  if (!key) {
    throw new Error("Missing FAWATERAK_VENDOR_KEY");
  }
  return key;
}

async function fawaterakFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Fawaterak request failed (${response.status}): ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data as T;
}

export async function getFawaterakPaymentMethods(): Promise<FawaterakPaymentMethod[]> {
  const response = await fawaterakFetch<FawaterakApiResponse<FawaterakPaymentMethod[]>>(
    "/getPaymentmethods",
    { method: "GET" }
  );

  return Array.isArray(response?.data) ? response.data : [];
}

function matchMethodToKind(method: FawaterakPaymentMethod, kind: FawaterakMethodKind) {
  const haystack = `${method.name_en} ${method.name_ar}`.toLowerCase();

  if (kind === "cards") {
    return (
      haystack.includes("visa") ||
      haystack.includes("master") ||
      haystack.includes("card")
    );
  }

  if (kind === "wallets") {
    return (
      haystack.includes("wallet") ||
      haystack.includes("meeza") ||
      haystack.includes("vodafone") ||
      haystack.includes("orange") ||
      haystack.includes("etisalat")
    );
  }

  return haystack.includes("fawry");
}

export function pickMethodByKind(
  methods: FawaterakPaymentMethod[],
  kind: FawaterakMethodKind
) {
  return methods.find((method) => matchMethodToKind(method, kind)) || null;
}

export async function createFawaterakInvoice(input: {
  paymentMethodId: number;
  amount: number;
  successUrl: string;
  failUrl: string;
  pendingUrl: string;
  /** Per-invoice override; Fawaterak docs: redirectionUrls.webhookUrl */
  webhookUrl?: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
  };
  payLoad: Record<string, unknown>;
}) {
  const response = await fawaterakFetch<FawaterakApiResponse<FawaterakInitPayResponseData>>(
    "/invoiceInitPay",
    {
      method: "POST",
      body: JSON.stringify({
        payment_method_id: input.paymentMethodId,
        cartTotal: input.amount.toFixed(2),
        currency: "EGP",
        customer: input.customer,
        redirectionUrls: {
          successUrl: input.successUrl,
          failUrl: input.failUrl,
          pendingUrl: input.pendingUrl,
          ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
        },
        cartItems: [
          {
            name: "Balance Topup",
            price: input.amount.toFixed(2),
            quantity: "1",
          },
        ],
        payLoad: input.payLoad,
      }),
    }
  );

  return response.data;
}

export async function createFawaterakInvoiceLink(input: {
  amount: number;
  successUrl: string;
  failUrl: string;
  pendingUrl: string;
  /** Per-invoice override; Fawaterak docs: redirectionUrls.webhookUrl */
  webhookUrl?: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
  };
  payLoad: Record<string, unknown>;
}) {
  const response = await fawaterakFetch<FawaterakApiResponse<FawaterakInvoiceLinkResponseData>>(
    "/createInvoiceLink",
    {
      method: "POST",
      body: JSON.stringify({
        cartTotal: input.amount.toFixed(2),
        currency: "EGP",
        customer: input.customer,
        redirectionUrls: {
          successUrl: input.successUrl,
          failUrl: input.failUrl,
          pendingUrl: input.pendingUrl,
          ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
        },
        cartItems: [
          {
            name: "Balance Topup",
            price: input.amount.toFixed(2),
            quantity: "1",
          },
        ],
        payLoad: input.payLoad,
      }),
    }
  );

  const rawData = response?.data as
    | (Partial<FawaterakInvoiceLinkResponseData> & {
        invoice_id?: number;
        invoice_key?: string;
      })
    | undefined;

  const url =
    typeof rawData?.url === "string"
      ? rawData.url
      : null;
  const invoiceId =
    typeof rawData?.invoiceId === "number"
      ? rawData.invoiceId
      : typeof rawData?.invoice_id === "number"
      ? rawData.invoice_id
      : null;
  const invoiceKey =
    typeof rawData?.invoiceKey === "string"
      ? rawData.invoiceKey
      : typeof rawData?.invoice_key === "string"
      ? rawData.invoice_key
      : null;

  if (!url || invoiceId == null || !invoiceKey) {
    throw new Error(
      `Invalid createInvoiceLink response: ${JSON.stringify(response)}`
    );
  }

  return {
    url,
    invoiceId,
    invoiceKey,
  };
}

export function generatePaidWebhookHash(input: {
  invoiceId: string | number;
  invoiceKey: string;
  paymentMethod: string;
}) {
  const payload = `InvoiceId=${input.invoiceId}&InvoiceKey=${input.invoiceKey}&PaymentMethod=${input.paymentMethod}`;
  return crypto.createHmac("sha256", getVendorKey()).update(payload).digest("hex");
}

export function generateCancelWebhookHash(input: {
  referenceId: string;
  paymentMethod: string;
}) {
  const payload = `referenceId=${input.referenceId}&PaymentMethod=${input.paymentMethod}`;
  return crypto.createHmac("sha256", getVendorKey()).update(payload).digest("hex");
}
