import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCancelWebhookHash, generatePaidWebhookHash } from "@/lib/fawaterak";

interface PaidWebhookBody {
  hashKey?: string;
  invoice_id?: number | string;
  invoice_key?: string;
  payment_method?: string;
  invoice_status?: string;
  pay_load?: unknown;
  payLoad?: unknown;
  referenceNumber?: string;
  errorMessage?: string;
}

interface CancelWebhookBody {
  hashKey?: string;
  referenceId?: string;
  paymentMethod?: string;
  status?: string;
  pay_load?: unknown;
}

function coerceInvoiceId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return parseInt(raw.trim(), 10);
  }
  return null;
}

function parsePayLoad(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return null;
}

function extractPayLoadRaw(body: Record<string, unknown>): unknown {
  if (body.pay_load != null) return body.pay_load;
  if (body.payLoad != null) return body.payLoad;
  return null;
}

async function applyPaidDeposit(invoiceId: number, userId: string, amount: number) {
  const invoiceMarker = `[FAWATERAK_INVOICE:${invoiceId}]`;
  const existingTransaction = await db.balanceTransaction.findFirst({
    where: {
      userId,
      type: "DEPOSIT",
      description: {
        contains: invoiceMarker,
      },
    },
    select: { id: true },
  });

  if (existingTransaction) {
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    await tx.balanceTransaction.create({
      data: {
        userId,
        amount,
        type: "DEPOSIT",
        description: `Fawaterak deposit ${amount.toFixed(2)} EGP ${invoiceMarker}`,
      },
    });

    await tx.fawaterakPendingInvoice.deleteMany({
      where: { invoiceId },
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PaidWebhookBody & CancelWebhookBody & Record<string, unknown>;

    const invoiceId = coerceInvoiceId(body.invoice_id);
    const invoiceKey = typeof body.invoice_key === "string" ? body.invoice_key : null;
    const paymentMethod = typeof body.payment_method === "string" ? body.payment_method : null;
    const invoiceStatus = typeof body.invoice_status === "string" ? body.invoice_status : null;

    const isPaidWebhook =
      invoiceId != null &&
      invoiceKey != null &&
      paymentMethod != null &&
      invoiceStatus != null;

    if (isPaidWebhook) {
      const expectedHash = generatePaidWebhookHash({
        invoiceId,
        invoiceKey,
        paymentMethod,
      });

      if (!body.hashKey || body.hashKey.toLowerCase() !== expectedHash.toLowerCase()) {
        console.warn("[FAWATERAK_WEBHOOK_JSON] Invalid paid webhook hash", {
          invoiceId,
          hasHash: Boolean(body.hashKey),
        });
        return new NextResponse("Invalid webhook hash", { status: 401 });
      }

      if (invoiceStatus.toLowerCase() !== "paid") {
        return NextResponse.json({
          success: true,
          message: `Ignored invoice status: ${invoiceStatus}`,
        });
      }

      const payLoad = parsePayLoad(extractPayLoadRaw(body));
      let userId = typeof payLoad?.userId === "string" ? payLoad.userId : null;
      let amount = Number(payLoad?.amount ?? 0);

      if (!userId || !Number.isFinite(amount) || amount <= 0) {
        const pending = await db.fawaterakPendingInvoice.findUnique({
          where: { invoiceId },
        });
        if (pending) {
          userId = pending.userId;
          amount = pending.amount;
        }
      }

      if (!userId || !Number.isFinite(amount) || amount <= 0) {
        console.error("[FAWATERAK_WEBHOOK_JSON] Missing userId/amount and no pending row", {
          invoiceId,
          payLoadEmpty: payLoad == null,
        });
        return new NextResponse("Missing userId or amount in pay_load", { status: 400 });
      }

      await applyPaidDeposit(invoiceId, userId, amount);

      return NextResponse.json({ success: true });
    }

    const isFailedWebhook =
      invoiceId != null &&
      invoiceKey != null &&
      paymentMethod != null &&
      typeof body.errorMessage === "string";

    if (isFailedWebhook) {
      const expectedHash = generatePaidWebhookHash({
        invoiceId,
        invoiceKey,
        paymentMethod,
      });

      if (!body.hashKey || body.hashKey.toLowerCase() !== expectedHash.toLowerCase()) {
        return new NextResponse("Invalid failed webhook hash", { status: 401 });
      }

      return NextResponse.json({ success: true, status: "failed-received" });
    }

    const isCancelWebhook =
      typeof body.referenceId === "string" && typeof body.paymentMethod === "string";

    if (isCancelWebhook) {
      const expectedHash = generateCancelWebhookHash({
        referenceId: body.referenceId as string,
        paymentMethod: body.paymentMethod as string,
      });

      if (!body.hashKey || body.hashKey.toLowerCase() !== expectedHash.toLowerCase()) {
        return new NextResponse("Invalid cancel webhook hash", { status: 401 });
      }

      return NextResponse.json({ success: true, status: body.status || "received" });
    }

    const isRefundWebhook =
      typeof (body as Record<string, unknown>).transactionId !== "undefined" &&
      typeof (body as Record<string, unknown>).status === "string" &&
      typeof (body as Record<string, unknown>).amount !== "undefined";

    if (isRefundWebhook) {
      return NextResponse.json({ success: true, status: "refund-received" });
    }

    console.warn("[FAWATERAK_WEBHOOK_JSON] Unsupported payload keys", {
      keys: Object.keys(body),
    });
    return new NextResponse("Unsupported webhook payload", { status: 400 });
  } catch (error) {
    console.error("[FAWATERAK_WEBHOOK_JSON]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
