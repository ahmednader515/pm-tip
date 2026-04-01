import { NextResponse } from "next/server";
import { getFawaterakPaymentMethods, pickMethodByKind } from "@/lib/fawaterak";

export async function GET() {
  try {
    const methods = await getFawaterakPaymentMethods();

    const cards = pickMethodByKind(methods, "cards");
    const wallets = pickMethodByKind(methods, "wallets");
    const fawry = pickMethodByKind(methods, "fawry");

    const fallback = {
      cards: {
        paymentId: 2,
        name_en: "Visa-Mastercard",
        name_ar: "بطاقات",
        redirect: "true",
        logo: "https://staging.fawaterk.com/clients/payment_options/MC_VI_MEpng",
      },
      wallets: {
        paymentId: 4,
        name_en: "Wallets",
        name_ar: "محافظ",
        redirect: "false",
        logo: "https://staging.fawaterk.com/clients/payment_options/pay5.png",
      },
      fawry: {
        paymentId: 3,
        name_en: "Fawry",
        name_ar: "فوري",
        redirect: "false",
        logo: "https://staging.fawaterk.com/clients/payment_options/fawrypng",
      },
    };

    return NextResponse.json({
      cards: cards || fallback.cards,
      wallets: wallets || fallback.wallets,
      fawry: fawry || fallback.fawry,
      isFallback: !cards || !wallets || !fawry,
    });
  } catch (error) {
    console.error("[FAWATERAK_PAYMENT_METHODS]", error);
    return new NextResponse("Failed to load Fawaterak payment methods", { status: 500 });
  }
}
