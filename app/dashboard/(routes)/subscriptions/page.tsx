"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, BookOpen, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

type SubCourse = { id: string; title: string; titleEn?: string | null; imageUrl: string | null };
type SubscriptionItem = {
  id: string;
  title: string;
  titleEn?: string | null;
  type: string;
  price: number;
  teacherName: string;
  courses: SubCourse[];
  myPurchase: { expiresAt: string } | null;
  expiredAt: string | null;
};

function getRemainingText(
  expiresAt: string,
  t: ReturnType<typeof useTranslations<"dashboard.student.subscriptions">>
): string {
  const now = new Date();
  const end = new Date(expiresAt);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? t("remainingMonthsOne") : t("remainingMonths", { count: months });
  }
  if (diffDays === 0) {
    return t("endsToday");
  }
  return diffDays === 1 ? t("remainingDaysOne") : t("remainingDays", { count: diffDays });
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const t = useTranslations("dashboard.student.subscriptions");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
    fetchBalance();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/subscriptions", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      } else {
        toast.error(t("loadFailed"));
      }
    } catch (e) {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/user/balance");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePurchase = async (sub: SubscriptionItem) => {
    if (balance !== null && balance < sub.price) {
      toast.error(t("insufficientBalance"));
      return;
    }
    setPurchasingId(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/purchase`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(t("purchaseSuccess", { count: data.coursesAdded }));
        setBalance(data.newBalance ?? balance);
        router.push("/dashboard/search");
      } else {
        const msg = res.ok ? data.message : await res.text();
        toast.error(msg || t("purchaseFailed"));
      }
    } catch (e) {
      toast.error(t("purchaseFailed"));
    } finally {
      setPurchasingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{tCommon("yourBalance")}</span>
          <span className="font-semibold">
            {balance !== null ? tCommon("egpAmount", { amount: balance.toFixed(2) }) : "—"}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/balance">{tCommon("topUpBalance")}</Link>
          </Button>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              {t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => {
            const hasActiveSubscription = !!sub.myPurchase;
            const isExpired = !hasActiveSubscription && !!sub.expiredAt;
            const canAfford = balance !== null && balance >= sub.price;
            const isPurchasing = purchasingId === sub.id;
            const formatExpiredDate = (iso: string) =>
              new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            return (
              <Card
                key={sub.id}
                className={
                  isExpired
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                    : undefined
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {localizedField(sub as unknown as Record<string, unknown>, "title", locale)}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                      {sub.type === "MONTHLY" ? t("monthly") : t("yearly")}
                    </Badge>
                    <span className="font-semibold text-brand">
                      {tCommon("egpAmount", { amount: sub.price })}
                    </span>
                    {hasActiveSubscription && sub.myPurchase && (
                      <Badge variant="default" className="bg-green-600">
                        {getRemainingText(sub.myPurchase.expiresAt, t)}
                      </Badge>
                    )}
                    {isExpired && sub.expiredAt && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {t("expired")}
                      </Badge>
                    )}
                  </div>
                  {isExpired && sub.expiredAt && (
                    <p className="text-xs text-muted-foreground">
                      {t("expiredOn", { date: formatExpiredDate(sub.expiredAt) })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{sub.teacherName}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1 mb-2">
                      <BookOpen className="h-4 w-4" />
                      {t("includedCourses", { count: sub.courses.length })}
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                      {sub.courses.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          {localizedField(c as unknown as Record<string, unknown>, "title", locale)}
                        </li>
                      ))}
                      {sub.courses.length > 5 && (
                        <li>{t("andMore", { count: sub.courses.length - 5 })}</li>
                      )}
                    </ul>
                  </div>
                  {hasActiveSubscription ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled
                    >
                      {t("active")}
                    </Button>
                  ) : (
                    <Button
                      className={
                        isExpired
                          ? "w-full bg-amber-600 hover:bg-amber-700 text-white"
                          : "w-full bg-brand hover:bg-brand/90 text-white"
                      }
                      onClick={() => handlePurchase(sub)}
                      disabled={!canAfford || isPurchasing}
                    >
                      {isPurchasing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isExpired ? (
                        t("renewBtn", { price: sub.price })
                      ) : canAfford ? (
                        t("subscribeNow", { price: sub.price })
                      ) : (
                        t("insufficient")
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
