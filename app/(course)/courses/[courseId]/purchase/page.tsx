"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Wallet, AlertCircle, Ticket, Check } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface Course {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  imageUrl?: string | null;
  price?: number | null;
}

export default function PurchasePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const router = useRouter();
  const { courseId } = use(params);
  const t = useTranslations("course");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [codeRedeemed, setCodeRedeemed] = useState(false);

  useEffect(() => {
    fetchCourse();
    fetchUserBalance();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (response.ok) {
        const data = await response.json();
        setCourse(data);
      } else {
        toast.error(t("loadCourseError"));
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error(t("loadCourseError"));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const response = await fetch("/api/user/balance");
      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!code.trim()) {
      toast.error(t("enterCode"));
      return;
    }

    setIsRedeeming(true);
    try {
      const response = await fetch("/api/codes/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        const charged = typeof data.amountCharged === "number" ? data.amountCharged : 0;
        const discount =
          typeof data.discountPercent === "number" ? data.discountPercent : 0;
        if (charged > 0) {
          toast.success(
            t("codeApplied", { discount, charged: charged.toFixed(2) })
          );
        } else {
          toast.success(t("codeRedeemed"));
        }
        setCodeRedeemed(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        const raw = await response.text();
        let message = raw;
        try {
          const errJson = JSON.parse(raw) as {
            error?: string;
            amountDue?: number;
          };
          if (errJson?.error === "Insufficient balance" && typeof errJson.amountDue === "number") {
            message = t("insufficientAfterDiscount", { amount: errJson.amountDue.toFixed(2) });
          } else if (errJson?.error) {
            message = String(errJson.error);
          }
        } catch {
          /* plain text body */
        }
        if (message.includes("already been used")) {
          toast.error(t("codeAlreadyUsed"));
        } else if (message.includes("already purchased")) {
          toast.error(t("alreadyPurchased"));
        } else if (message.includes("Invalid code")) {
          toast.error(t("invalidCode"));
        } else if (message.includes("Insufficient balance")) {
          toast.error(t("insufficientToComplete"));
        } else {
          toast.error(message || t("redeemError"));
        }
      }
    } catch (error) {
      console.error("Error redeeming code:", error);
      toast.error(t("redeemError"));
    } finally {
      setIsRedeeming(false);
    }
  };

  const handlePurchase = async () => {
    if (!course) return;

    setIsPurchasing(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/purchase`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t("purchaseSuccess"));
        router.push("/dashboard");
      } else {
        const error = await response.text();
        if (error.includes("Insufficient balance")) {
          toast.error(t("insufficientAddBalance"));
        } else if (error.includes("already purchased")) {
          toast.error(t("alreadyPurchased"));
        } else {
          toast.error(error || t("purchaseError"));
        }
      }
    } catch (error) {
      console.error("Error purchasing course:", error);
      toast.error(t("purchaseError"));
    } finally {
      setIsPurchasing(false);
    }
  };

  const hasSufficientBalance = course && userBalance >= (course.price || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
<h1 className="text-2xl font-bold mb-4">{t("courseNotFound")}</h1>
          <Button asChild>
<Link href="/dashboard">{t("backToDashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {tCommon("back")}
            </Button>
<h1 className="text-2xl font-bold">{t("purchase")}</h1>
          </div>

          {/* Course Details */}
          <Card>
            <CardHeader>
              <CardTitle>{localizedField(course as unknown as Record<string, unknown>, "title", locale)}</CardTitle>
              <CardDescription>
{localizedField(course as unknown as Record<string, unknown>, "description", locale) || t("noDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {course.imageUrl && (
                <div className="mb-4">
                  <img
                    src={course.imageUrl}
                    alt={localizedField(course as unknown as Record<string, unknown>, "title", locale)}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
              <div className="text-2xl font-bold text-brand">
{tCommon("egpAmount", { amount: course.price?.toFixed(2) || "0.00" })}
              </div>
            </CardContent>
          </Card>

          {/* Balance Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t("accountBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBalance ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"></div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xl font-bold">
{tCommon("egpAmount", { amount: userBalance.toFixed(2) })}
                  </div>
                  {!hasSufficientBalance && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
<span>{t("insufficientForCourse")}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Code Redemption */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                {t("haveDiscountCode")}
              </CardTitle>
              <CardDescription>
                {t("discountCodeHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="code" className="sr-only">
                    {t("discountCode")}
                  </Label>
                  <Input
                    id="code"
placeholder={t("enterCodePlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={isRedeeming || codeRedeemed}
                    className="text-center font-mono"
                  />
                </div>
                <Button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming || !code.trim() || codeRedeemed}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isRedeeming ? (
t("redeeming")
                  ) : codeRedeemed ? (
                    <>
                      <Check className="h-4 w-4 ml-2" />
                      {t("redeemed")}
                    </>
                  ) : (
t("redeemCode")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
<span className="bg-background px-2 text-muted-foreground">{tCommon("or")}</span>
            </div>
          </div>

          {/* Purchase Actions */}
          <div className="space-y-4">
            {!hasSufficientBalance && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-700 mb-4">
                    <AlertCircle className="h-5 w-5" />
<span className="font-medium">{t("insufficientForCourse")}</span>
                  </div>
                  <p className="text-amber-700 mb-4">
{t("needMoreBalance", { amount: (course.price || 0) - userBalance })}
                  </p>
                  <Button asChild className="bg-brand hover:bg-brand/90">
<Link href="/dashboard/balance">{t("addBalance")}</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handlePurchase}
              disabled={isPurchasing || !hasSufficientBalance || codeRedeemed}
              className="w-full bg-brand hover:bg-brand/90 text-white"
              size="lg"
            >
              {isPurchasing ? (
t("purchasing")
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t("purchase")}
                </div>
              )}
            </Button>

            {!codeRedeemed && (
              <div className="text-center text-sm text-muted-foreground">
<p>{t("willDeduct", { amount: course.price?.toFixed(2) || "0.00" })}</p>
<p>{t("instantAccess")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 