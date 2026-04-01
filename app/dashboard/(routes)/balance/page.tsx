"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Wallet, Plus, History, ArrowUpRight, CreditCard, Landmark, CircleDollarSign, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";

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
}

const methodDesign: Record<
  PaymentMethodKind,
  {
    title: string;
    subtitle: string;
    icon: typeof CreditCard;
    badgeClass: string;
  }
> = {
  cards: {
    title: "بطاقات ائتمانية",
    subtitle: "Visa / Mastercard / Meeza",
    icon: CreditCard,
    badgeClass: "bg-blue-100 text-blue-700",
  },
  fawry: {
    title: "Fawry",
    subtitle: "الدفع بكود فوري",
    icon: CircleDollarSign,
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  wallets: {
    title: "المحافظ الإلكترونية",
    subtitle: "Vodafone / Orange / Etisalat",
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

  const fetchBalance = useCallback(async () => {
    try {
      const response = await fetch("/api/user/balance");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, []);

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
    if (isStudent) {
      fetchPaymentMethods();
    }
  }, [isStudent, fetchBalance, fetchTransactions]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");

    if (paymentResult === "success") {
      toast.success(
        "تم إكمال الدفع. جاري تحديث الرصيد… إذا تأخر الظهور، حدّث الصفحة بعد لحظات وتأكد أن Webhook في لوحة Fawaterak مضبوط على نطاقك."
      );
    } else if (paymentResult === "pending") {
      toast.info("عملية الدفع قيد المراجعة. سيتم إضافة الرصيد تلقائياً بعد التأكيد.");
    } else if (paymentResult === "failed") {
      toast.error("عملية الدفع لم تكتمل. يمكنك المحاولة مرة أخرى.");
    }

    if (paymentResult) {
      window.history.replaceState({}, "", window.location.pathname);
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
      void fetchBalance();
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
      toast.error("تعذر تحميل وسائل الدفع، حاول مرة أخرى");
    } finally {
      setIsLoadingMethods(false);
    }
  };

  const handleAddBalance = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
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
        toast.success("تم إضافة الرصيد بنجاح");
        fetchTransactions({ silent: true }); // Refresh transactions
      } else {
        const error = await response.text();
        toast.error(error || "حدث خطأ أثناء إضافة الرصيد");
      }
    } catch (error) {
      console.error("Error adding balance:", error);
      toast.error("حدث خطأ أثناء إضافة الرصيد");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGatewayCheckout = async () => {
    const parsedAmount = parseFloat(gatewayAmount);
    if (!gatewayAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    if (!availableMethods[selectedMethod]) {
      toast.error("وسيلة الدفع المحددة غير متاحة حالياً");
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

      if (!response.ok) {
        const error = await response.text();
        toast.error(error || "فشل إنشاء عملية الدفع");
        return;
      }

      const data = (await response.json()) as CheckoutResponse;

      const redirectUrl = data.redirectUrl || null;

      if (typeof data.invoiceId === "number") {
        sessionStorage.setItem(
          "fawaterak_pending",
          JSON.stringify({ invoiceId: data.invoiceId, savedAt: Date.now() })
        );
      }

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      toast.error("تعذر فتح بوابة الدفع. حاول مرة أخرى.");
    } catch (error) {
      console.error("Error initializing payment:", error);
      toast.error("حدث خطأ أثناء بدء عملية الدفع");
    } finally {
      setIsInitializingPayment(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الرصيد</h1>
          <p className="text-muted-foreground">
            {isStudent 
              ? "عرض رصيد حسابك وسجل المعاملات" 
              : "أضف رصيد إلى حسابك لشراء الكورسات"
            }
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            رصيد الحساب
          </CardTitle>
          <CardDescription>
            الرصيد المتاح في حسابك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-brand">
            {balance.toFixed(2)} جنيه
          </div>
        </CardContent>
      </Card>

      {/* Add Balance Section - Only for non-students */}
      {!isStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              إضافة رصيد
            </CardTitle>
            <CardDescription>
              أضف مبلغ إلى رصيد حسابك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="number"
                placeholder="أدخل المبلغ"
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
                {isLoading ? "جاري الإضافة..." : "إضافة الرصيد"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Deposit Section - Only for students */}
      {isStudent && (
        <Card className="border-brand/20 bg-brand/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand" />
              إضافة رصيد عن طريق بوابة الدفع
            </CardTitle>
            <CardDescription>
              اختر وسيلة الدفع المناسبة وأكمل العملية من بوابة الدفع
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gatewayAmount">المبلغ (جنيه)</Label>
              <Input
                id="gatewayAmount"
                type="number"
                placeholder="أدخل المبلغ"
                value={gatewayAmount}
                onChange={(e) => setGatewayAmount(e.target.value)}
                min="1"
                step="0.01"
              />
            </div>

            {isLoadingMethods ? (
              <div className="text-sm text-muted-foreground">جاري تحميل وسائل الدفع...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["cards", "fawry", "wallets"] as PaymentMethodKind[]).map((methodKey) => {
                  const method = availableMethods[methodKey];
                  const selected = selectedMethod === methodKey;
                  const isDisabled = !method;
                  const Icon = methodDesign[methodKey].icon;

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
                        <div className={`rounded-lg p-2 min-h-10 min-w-10 flex items-center justify-center ${methodDesign[methodKey].badgeClass}`}>
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
                          <p className="font-semibold text-sm">{methodDesign[methodKey].title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {methodDesign[methodKey].subtitle}
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
              {isInitializingPayment ? "جاري بدء الدفع..." : "الدفع عبر Fawaterak"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            سجل المعاملات
          </CardTitle>
          <CardDescription>
            تاريخ جميع المعاملات المالية
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
              <p className="mt-2 text-muted-foreground">جاري التحميل...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد معاملات حتى الآن</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === "DEPOSIT" 
                        ? "bg-green-100 text-green-600" 
                        : "bg-red-100 text-red-600"
                    }`}>
                      {transaction.type === "DEPOSIT" ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                                         <div>
                       <p className="font-medium">
                         {transaction.description.includes("Added") && transaction.type === "DEPOSIT" 
                           ? transaction.description.replace(/Added (\d+(?:\.\d+)?) EGP to balance/, "تم إضافة $1 جنيه إلى الرصيد")
                           : transaction.description.includes("Purchased course:") && transaction.type === "PURCHASE"
                           ? transaction.description.replace(/Purchased course: (.+)/, "تم شراء الكورس: $1")
                           : transaction.description
                         }
                       </p>
                       <p className="text-sm text-muted-foreground">
                         {formatDate(transaction.createdAt)}
                       </p>
                       <p className="text-xs text-muted-foreground">
                         {transaction.type === "DEPOSIT" ? "إيداع" : "شراء كورس"}
                       </p>
                     </div>
                  </div>
                  <div className={`font-bold ${
                    transaction.type === "DEPOSIT" ? "text-green-600" : "text-red-600"
                  }`}>
                    {transaction.type === "DEPOSIT" ? "+" : "-"}
                    {Math.abs(transaction.amount).toFixed(2)} جنيه
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