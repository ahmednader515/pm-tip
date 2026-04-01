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
  await db.fawaterakPendingInvoice.upsert({
    where: { invoiceId },
    create: {
      userId,
      invoiceId,
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

    // For Fawry and Wallets we prefer hosted gateway URL, and gracefully
    // fallback to invoiceInitPay if createInvoiceLink returns gateway error.
    if (methodKind === "fawry" || methodKind === "wallets") {
      try {
        const invoiceLink = await createFawaterakInvoiceLink({
          amount,
          successUrl,
          failUrl,
          pendingUrl,
          customer: {
            // keep a strict/known-safe format for createInvoiceLink endpoint
            first_name: "test",
            last_name: "user",
            email: "no-email@example.com",
            phone: "01000000000",
            address: "Egypt",
          },
          payLoad,
        });

        await recordPendingTopup(userId, invoiceLink.invoiceId, invoiceLink.invoiceKey, amount);

        return NextResponse.json({
          method: methodKind,
          methodName:
            selectedMethod?.name_ar ||
            selectedMethod?.name_en ||
            `${methodKind.toUpperCase()} (${selectedPaymentMethodId})`,
          invoiceId: invoiceLink.invoiceId,
          invoiceKey: invoiceLink.invoiceKey,
          paymentData: null,
          redirectUrl: invoiceLink.url,
        });
      } catch (linkError) {
        console.warn("[FAWATERAK_CHECKOUT] createInvoiceLink failed, fallback to invoiceInitPay", linkError);
      }
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

    await recordPendingTopup(userId, invoice.invoice_id, invoice.invoice_key, amount);

    return NextResponse.json({
      method: methodKind,
      methodName:
        selectedMethod?.name_ar ||
        selectedMethod?.name_en ||
        `${methodKind.toUpperCase()} (${selectedPaymentMethodId})`,
      invoiceId: invoice.invoice_id,
      invoiceKey: invoice.invoice_key,
      paymentData: invoice.payment_data || null,
      redirectUrl:
        typeof invoice.payment_data?.redirectTo === "string"
          ? (invoice.payment_data.redirectTo as string)
          : null,
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
