"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  Wallet,
  Plus,
  History,
  ArrowUpRight,
  CreditCard,
  Landmark,
  CircleDollarSign,
  CheckCircle2,
  Smartphone,
  Building2,
  Copy,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  SHOW_FAWATERAK_GATEWAY,
  MANUAL_VODAFONE_CASH_NUMBER,
  MANUAL_INSTAPAY_NUMBER,
} from "@/lib/balance-payment-display";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";

interface BalanceTransaction {
  id: string;
  amount: number;
  type: "DEPOSIT" | "PURCHASE";
  description: string;
  createdAt: string;
}

type PaymentMethodKind = "cards" | "wallets" | "fawry";

interface GatewayMethod {
  paymentId: number;
  name_en: string;
  name_ar: string;
  redirect: string;
  logo?: string;
}

interface MethodsResponse {
  cards: GatewayMethod | null;
  wallets: GatewayMethod | null;
  fawry: GatewayMethod | null;
  isFallback?: boolean;
}

interface CheckoutResponse {
  method: PaymentMethodKind;
  redirectUrl?: string | null;
  invoiceId?: number;
  invoiceKey?: string;
  fawryCode?: string;
  fawryExpireDate?: string;
  meezaReference?: string;
}

const methodDesignBase: Record<
  PaymentMethodKind,
  {
    icon: typeof CreditCard;
    badgeClass: string;
  }
> = {
  cards: {
    icon: CreditCard,
    badgeClass: "bg-blue-100 text-blue-700",
  },
  fawry: {
    icon: CircleDollarSign,
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  wallets: {
    icon: Landmark,
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
};

const methodImageFallback: Record<PaymentMethodKind, string> = {
  cards: "https://staging.fawaterk.com/clients/payment_options/MC_VI_MEpng",
  fawry: "https://staging.fawaterk.com/clients/payment_options/fawrypng",
  wallets: "https://staging.fawaterk.com/clients/payment_options/pay5.png",
};

export default function BalancePage() {
  const { data: session } = useSession();
  const t = useTranslations("dashboard.student.balance");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [gatewayAmount, setGatewayAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKind>("cards");
  const [availableMethods, setAvailableMethods] = useState<MethodsResponse>({
    cards: null,
    wallets: null,
    fawry: null,
  });
  const [brokenLogos, setBrokenLogos] = useState<Record<PaymentMethodKind, boolean>>({
    cards: false,
    wallets: false,
    fawry: false,
  });
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  // Check if user is a student (USER role)
  const isStudent = session?.user?.role === "USER";

  const fetchBalance = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const response = await fetch("/api/user/balance");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      } else {
        const t = await response.text();
        console.error("[BALANCE_PAGE] balance fetch failed", response.status, t);
        if (!opts?.silent) {
          toast.error(
            response.status === 401
              ? t("sessionExpired")
              : t("balanceLoadFailed")
          );
        }
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      if (!opts?.silent) {
        toast.error(t("balanceConnectFailed"));
      }
    }
  }, [t]);

  const fetchTransactions = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const response = await fetch("/api/balance/transactions");
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      if (!opts?.silent) {
        setIsLoadingTransactions(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    if (isStudent && SHOW_FAWATERAK_GATEWAY) {
      fetchPaymentMethods();
    } else if (isStudent) {
      setIsLoadingMethods(false);
    }
  }, [isStudent, fetchBalance, fetchTransactions]);

  useEffect(() => {
    const RETURN_KEY = "fawaterak_payment_return";
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("payment");
    const invoiceIdFromGateway = params.get("invoice_id");

    if (fromQuery) {
      try {
        sessionStorage.setItem(RETURN_KEY, fromQuery);
        if (
          fromQuery === "success" &&
          invoiceIdFromGateway &&
          /^\d+$/.test(invoiceIdFromGateway.trim())
        ) {
          sessionStorage.setItem(
            "fawaterak_success_invoice_id",
            invoiceIdFromGateway.trim()
          );
        }
        if (
          (fromQuery === "success" || fromQuery === "pending") &&
          !sessionStorage.getItem("fawaterak_pending")
        ) {
          sessionStorage.setItem(
            "fawaterak_pending",
            JSON.stringify({ savedAt: Date.now(), fromReturn: true })
          );
        }
      } catch {
        /* ignore */
      }
      window.history.replaceState({}, "", window.location.pathname);
    }

    let paymentResult: string | null = null;
    try {
      paymentResult = sessionStorage.getItem(RETURN_KEY);
      if (paymentResult) {
        sessionStorage.removeItem(RETURN_KEY);
      }
    } catch {
      paymentResult = fromQuery;
    }

    if (paymentResult === "success") {
      toast.success(t("paymentSuccessToast"));

      let invoiceIdStr = invoiceIdFromGateway?.trim() ?? "";
      if (!/^\d+$/.test(invoiceIdStr)) {
        try {
          invoiceIdStr = sessionStorage.getItem("fawaterak_success_invoice_id") ?? "";
        } catch {
          invoiceIdStr = "";
        }
      }
      const invoiceIdNum = /^\d+$/.test(invoiceIdStr)
        ? parseInt(invoiceIdStr, 10)
        : NaN;
      if (Number.isFinite(invoiceIdNum)) {
        try {
          sessionStorage.removeItem("fawaterak_success_invoice_id");
        } catch {
          /* ignore */
        }
        void fetch("/api/fawaterak/sync-return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ invoiceId: invoiceIdNum }),
        })
          .then(() => {
            void fetchBalance({ silent: true });
            void fetchTransactions({ silent: true });
          })
          .catch((e) => console.error("[fawaterak sync-return]", e));
      }
    } else if (paymentResult === "pending") {
      toast.info(t("paymentPendingToast"));
    } else if (paymentResult === "failed") {
      toast.error(t("paymentFailedToast"));
    }

    if (paymentResult === "failed") {
      sessionStorage.removeItem("fawaterak_pending");
    }

    const hasPendingFlag = Boolean(sessionStorage.getItem("fawaterak_pending"));
    const shouldPoll =
      paymentResult === "success" ||
      paymentResult === "pending" ||
      (hasPendingFlag && paymentResult !== "failed");

    if (!shouldPoll) {
      return;
    }

    const poll = () => {
      void fetchBalance({ silent: true });
      void fetchTransactions({ silent: true });
    };

    poll();
    const interval = setInterval(poll, 2500);
    const stop = setTimeout(() => {
      clearInterval(interval);
      sessionStorage.removeItem("fawaterak_pending");
    }, 45000);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [fetchBalance, fetchTransactions]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch("/api/fawaterak/payment-methods");
      if (!response.ok) {
        throw new Error("Failed to load payment methods");
      }

      const data = (await response.json()) as MethodsResponse;
      setAvailableMethods(data);
      setBrokenLogos({ cards: false, wallets: false, fawry: false });

      if (!data.cards && data.wallets) {
        setSelectedMethod("wallets");
      } else if (!data.cards && !data.wallets && data.fawry) {
        setSelectedMethod("fawry");
      }
    } catch (error) {
      console.error("Error fetching fawaterak methods:", error);
      toast.error(t("methodsLoadError"));
    } finally {
      setIsLoadingMethods(false);
    }
  };

  const handleAddBalance = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/balance/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.newBalance);
        setAmount("");
        toast.success(t("balanceAdded"));
        fetchTransactions({ silent: true }); // Refresh transactions
      } else {
        const error = await response.text();
        toast.error(error || t("addBalanceError"));
      }
    } catch (error) {
      console.error("Error adding balance:", error);
      toast.error(t("addBalanceError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGatewayCheckout = async () => {
    const parsedAmount = parseFloat(gatewayAmount);
    if (!gatewayAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }

    if (!availableMethods[selectedMethod]) {
      toast.error(t("methodUnavailable"));
      return;
    }

    setIsInitializingPayment(true);

    try {
      const response = await fetch("/api/fawaterak/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parsedAmount,
          method: selectedMethod,
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        toast.error(responseText || t("checkoutFailed", { status: response.status }));
        return;
      }

      let data: CheckoutResponse;
      try {
        data = JSON.parse(responseText) as CheckoutResponse;
      } catch {
        console.error("[BALANCE_PAGE] checkout JSON parse error", responseText.slice(0, 200));
        toast.error(t("invalidPaymentResponse"));
        return;
      }

      const redirectUrl = data.redirectUrl || null;
      const invoiceId =
        typeof data.invoiceId === "number"
          ? data.invoiceId
          : typeof data.invoiceId === "string" && /^\d+$/.test(data.invoiceId)
            ? parseInt(data.invoiceId, 10)
            : NaN;

      if (Number.isFinite(invoiceId)) {
        try {
          sessionStorage.setItem(
            "fawaterak_pending",
            JSON.stringify({ invoiceId, savedAt: Date.now() })
          );
        } catch {
          /* ignore */
        }
      }

      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      if (data.fawryCode) {
        const expiry = data.fawryExpireDate ? t("fawryExpiry", { date: data.fawryExpireDate }) : "";
        toast.info(t("fawryCode", { code: data.fawryCode, expiry }), { duration: 20000 });
        return;
      }

      if (data.meezaReference) {
        toast.info(t("meezaRef", { ref: data.meezaReference }), { duration: 20000 });
        return;
      }

      toast.error(t("noRedirectUrl"));
    } catch (error) {
      console.error("Error initializing payment:", error);
      toast.error(t("paymentStartError"));
    } finally {
      setIsInitializingPayment(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copiedLabel", { label }));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTransactionDescription = (transaction: BalanceTransaction) => {
    const { description, type } = transaction;

    if (description.includes("Added") && type === "DEPOSIT") {
      const m = description.match(/Added (\d+(?:\.\d+)?) EGP to balance/);
      if (m) return t("txnAdded", { amount: m[1] });
    }

    if (description.includes("Purchased course:") && type === "PURCHASE") {
      const m = description.match(/Purchased course: (.+)/);
      if (m) return t("txnPurchasedCourse", { title: m[1] });
    }

    if (description.includes("Purchased product:") && type === "PURCHASE") {
      const m = description.match(/Purchased product: (.+)/);
      if (m) return t("txnPurchasedProduct", { title: m[1] });
    }

    const fawaterakMatch = description.match(/Fawaterak deposit ([\d.]+) EGP/i);
    if (fawaterakMatch) {
      return t("txnFawaterak", { amount: fawaterakMatch[1] });
    }

    return description;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
<h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
{isStudent 
              ? t("subtitleStudent") 
              : t("subtitleTeacher")
            }
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
{t("accountBalance")}
          </CardTitle>
          <CardDescription>
{t("availableBalance")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-brand">
{tCommon("egpAmount", { amount: balance.toFixed(2) })}
          </div>
        </CardContent>
      </Card>

      {/* Add Balance Section - Only for non-students */}
      {!isStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
{t("addBalance")}
            </CardTitle>
            <CardDescription>
              {t("addBalanceDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="number"
placeholder={t("amountPlaceholder")}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="flex-1"
              />
              <Button 
                onClick={handleAddBalance}
                disabled={isLoading}
                className="bg-brand hover:bg-brand/90"
              >
{isLoading ? t("adding") : t("addBalanceBtn")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual transfer (Vodafone Cash / Instapay) — shown when gateway UI is off */}
      {isStudent && !SHOW_FAWATERAK_GATEWAY && (
        <Card className="border-brand/20 bg-brand/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand" />
{t("topUpTitle")}
            </CardTitle>
            <CardDescription>
              {t("topUpDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-4 w-4 text-brand" />
{t("vodafoneCash")}
              </div>
              {MANUAL_VODAFONE_CASH_NUMBER ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg dir-ltr tracking-wide" dir="ltr">
                    {MANUAL_VODAFONE_CASH_NUMBER}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
copyToClipboard(MANUAL_VODAFONE_CASH_NUMBER, t("copyVodafone"))
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
{tCommon("copy")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
{t("vodafoneNotSet")}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-brand" />
{t("instapay")}
              </div>
              {MANUAL_INSTAPAY_NUMBER ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg dir-ltr tracking-wide break-all" dir="ltr">
                    {MANUAL_INSTAPAY_NUMBER}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    onClick={() =>
copyToClipboard(MANUAL_INSTAPAY_NUMBER, t("copyInstapay"))
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {tCommon("copy")}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
{t("instapayNotSet")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fawaterak gateway — unchanged; toggle with NEXT_PUBLIC_SHOW_FAWATERAK_GATEWAY=true */}
      {isStudent && SHOW_FAWATERAK_GATEWAY && (
        <Card className="border-brand/20 bg-brand/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand" />
{t("gatewayTitle")}
            </CardTitle>
            <CardDescription>
              {t("gatewayDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
<Label htmlFor="gatewayAmount">{t("amountLabel")}</Label>
              <Input
                id="gatewayAmount"
                type="number"
                placeholder={t("amountPlaceholder")}
                value={gatewayAmount}
                onChange={(e) => setGatewayAmount(e.target.value)}
                min="1"
                step="0.01"
              />
            </div>

            {isLoadingMethods ? (
<div className="text-sm text-muted-foreground">{t("loadingMethods")}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["cards", "fawry", "wallets"] as PaymentMethodKind[]).map((methodKey) => {
                  const method = availableMethods[methodKey];
                  const selected = selectedMethod === methodKey;
                  const isDisabled = !method;
const Icon = methodDesignBase[methodKey].icon;

                  return (
                    <button
                      key={methodKey}
                      type="button"
                      onClick={() => !isDisabled && setSelectedMethod(methodKey)}
                      disabled={isDisabled}
                      className={`relative text-right rounded-xl border p-4 transition-all ${
                        selected
                          ? "border-brand ring-2 ring-brand/25 bg-brand/5"
                          : "border-border hover:border-brand/40 hover:bg-muted/30"
                      } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {selected && !isDisabled && (
                        <CheckCircle2 className="h-5 w-5 text-brand absolute top-3 left-3" />
                      )}

                      <div className="flex items-center justify-between gap-3">
<div className={`rounded-lg p-2 min-h-10 min-w-10 flex items-center justify-center ${methodDesignBase[methodKey].badgeClass}`}>
                          {!brokenLogos[methodKey] ? (
                            <img
                              src={methodImageFallback[methodKey]}
                              alt={method?.name_en || methodKey}
                              className="h-6 object-contain"
                              onError={() =>
                                setBrokenLogos((prev) => ({ ...prev, [methodKey]: true }))
                              }
                            />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <div>
<p className="font-semibold text-sm">{methodKey === "cards" ? t("methodCards") : methodKey === "fawry" ? t("methodFawry") : t("methodWallets")}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {methodKey === "cards" ? t("methodCardsSub") : methodKey === "fawry" ? t("methodFawrySub") : t("methodWalletsSub")}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              onClick={handleGatewayCheckout}
              disabled={isInitializingPayment || isLoadingMethods}
              className="w-full bg-brand hover:bg-brand/90 text-white"
              size="lg"
            >
{isInitializingPayment ? t("startingPayment") : t("payViaFawaterak")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
{t("transactionHistory")}
          </CardTitle>
          <CardDescription>
            {t("transactionHistoryDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
<p className="mt-2 text-muted-foreground">{tCommon("loading")}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
<p className="text-muted-foreground">{t("noTransactions")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-lg border p-3 sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 rounded-full p-2 ${
                        transaction.type === "DEPOSIT"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {transaction.type === "DEPOSIT" ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <p className="font-medium break-words leading-snug">
                          {formatTransactionDescription(transaction)}
                        </p>
                        <p
                          className={`shrink-0 self-end font-bold tabular-nums whitespace-nowrap sm:self-auto ${
                            transaction.type === "DEPOSIT"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                          dir="ltr"
                        >
                          {transaction.type === "DEPOSIT" ? "+" : "-"}
{tCommon("egpAmount", { amount: Math.abs(transaction.amount).toFixed(2) })}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(transaction.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
{transaction.type === "DEPOSIT" ? t("deposit") : t("purchase")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 