import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createFawaterakInvoice,
  createFawaterakInvoiceLink,
  getFawaterakPaymentMethods,
  pickMethodByKind,
  type FawaterakMethodKind,
} from "@/lib/fawaterak";

const fallbackMethodIds: Record<FawaterakMethodKind, number> = {
  cards: 2,
  fawry: 3,
  wallets: 4,
};

function getNameParts(fullName?: string | null) {
  const cleaned = (fullName || "Customer User").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "User" };
  }

  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "User",
  };
}

function sanitizeCustomerText(value: string, fallback: string) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9@_.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || fallback;
}

function sanitizePhone(value?: string) {
  const digitsOnly = (value || "").replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    return digitsOnly;
  }
  return "01000000000";
}

function normalizeMethod(method: unknown): FawaterakMethodKind | null {
  if (method === "cards" || method === "wallets" || method === "fawry") {
    return method;
  }
  return null;
}

async function recordPendingTopup(
  userId: string,
  invoiceId: number,
  invoiceKey: string,
  amount: number
) {
  const id = Math.trunc(Number(invoiceId));
  if (!Number.isFinite(id)) {
    throw new Error("Invalid invoice id for pending record");
  }
  await db.fawaterakPendingInvoice.upsert({
    where: { invoiceId: id },
    create: {
      userId,
      invoiceId: id,
      invoiceKey,
      amount,
    },
    update: {
      userId,
      invoiceKey,
      amount,
    },
  });
}

function pickRedirectUrl(paymentData: Record<string, unknown> | null | undefined): string | null {
  if (!paymentData || typeof paymentData !== "object") return null;
  const pd = paymentData as Record<string, unknown>;
  const candidates = ["redirectTo", "redirect_to", "redirectUrl", "url", "link"];
  for (const key of candidates) {
    const v = pd[key];
    if (typeof v === "string" && v.startsWith("http")) {
      return v;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as {
      amount?: number;
      method?: FawaterakMethodKind;
    };

    const amount = Number(body?.amount || 0);
    const methodKind = normalizeMethod(body?.method);

    if (!methodKind) {
      return new NextResponse("Invalid payment method", { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return new NextResponse("Invalid amount", { status: 400 });
    }

    const methods = await getFawaterakPaymentMethods();
    const selectedMethod = pickMethodByKind(methods, methodKind);
    const selectedPaymentMethodId = selectedMethod?.paymentId || fallbackMethodIds[methodKind];

    const callbackBaseUrl =
      process.env.FAWATERAK_CALLBACK_BASE_URL || new URL(req.url).origin;
    const successUrl = `${callbackBaseUrl}/dashboard/balance?payment=success`;
    const failUrl = `${callbackBaseUrl}/dashboard/balance?payment=failed`;
    const pendingUrl = `${callbackBaseUrl}/dashboard/balance?payment=pending`;

    const { firstName, lastName } = getNameParts(session.user?.name);
    const phone = (session.user as { phoneNumber?: string } | undefined)?.phoneNumber;

    const customer = {
      first_name: sanitizeCustomerText(firstName, "Customer"),
      last_name: sanitizeCustomerText(lastName, "User"),
      email: "no-email@example.com",
      phone: sanitizePhone(phone),
      address: "Egypt",
    };
    const payLoad = {
      type: "BALANCE_TOPUP",
      userId,
      amount,
      method: methodKind,
    };

    // Prefer hosted invoice link for every method when it works — always returns a browser URL.
    try {
      const invoiceLink = await createFawaterakInvoiceLink({
        amount,
        successUrl,
        failUrl,
        pendingUrl,
        customer: {
          first_name: "test",
          last_name: "user",
          email: "no-email@example.com",
          phone: "01000000000",
          address: "Egypt",
        },
        payLoad,
      });

      await recordPendingTopup(
        userId,
        invoiceLink.invoiceId,
        invoiceLink.invoiceKey,
        amount
      );

      return NextResponse.json({
        method: methodKind,
        methodName:
          selectedMethod?.name_ar ||
          selectedMethod?.name_en ||
          `${methodKind.toUpperCase()} (${selectedPaymentMethodId})`,
        invoiceId: Number(invoiceLink.invoiceId),
        invoiceKey: invoiceLink.invoiceKey,
        paymentData: null,
        redirectUrl: invoiceLink.url,
      });
    } catch (linkError) {
      console.warn(
        "[FAWATERAK_CHECKOUT] createInvoiceLink failed, fallback to invoiceInitPay",
        linkError
      );
    }

    const invoice = await createFawaterakInvoice({
      paymentMethodId: selectedPaymentMethodId,
      amount,
      successUrl,
      failUrl,
      pendingUrl,
      customer,
      payLoad,
    });

    const invId = Number(invoice.invoice_id);
    await recordPendingTopup(userId, invId, invoice.invoice_key, amount);

    const pd = (invoice.payment_data || null) as Record<string, unknown> | null;
    const redirectUrl = pickRedirectUrl(pd);
    const fawryCode = typeof pd?.fawryCode === "string" ? pd.fawryCode : undefined;
    const fawryExpireDate =
      typeof pd?.expireDate === "string" ? pd.expireDate : undefined;
    const meezaRef =
      pd?.meezaReference != null ? String(pd.meezaReference) : undefined;

    return NextResponse.json({
      method: methodKind,
      methodName:
        selectedMethod?.name_ar ||
        selectedMethod?.name_en ||
        `${methodKind.toUpperCase()} (${selectedPaymentMethodId})`,
      invoiceId: invId,
      invoiceKey: invoice.invoice_key,
      paymentData: invoice.payment_data || null,
      redirectUrl,
      fawryCode,
      fawryExpireDate,
      meezaReference: meezaRef,
    });
  } catch (error) {
    console.error("[FAWATERAK_CHECKOUT]", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize Fawaterak checkout";
    return new NextResponse(message, { status: 500 });
  }
}
