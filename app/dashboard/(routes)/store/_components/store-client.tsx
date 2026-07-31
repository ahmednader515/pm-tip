"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { ShoppingBag, Wallet, ExternalLink, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import { getDir, type Locale } from "@/i18n/config";

type StoreProduct = {
    id: string;
    title: string;
    titleEn?: string | null;
    description: string | null;
    descriptionEn?: string | null;
    imageUrl: string | null;
    price: number;
    isPurchased: boolean;
};

type PurchaseRow = {
    id: string;
    pricePaid: number;
    createdAt: string;
    product: {
        id: string;
        title: string;
        titleEn?: string | null;
        description: string | null;
        descriptionEn?: string | null;
        imageUrl: string | null;
        price: number;
        downloadUrl: string;
    };
};

export function StoreClient() {
    const t = useTranslations("store");
    const tCommon = useTranslations("common");
    const locale = useLocale() as Locale;
    const dir = getDir(locale);
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [purchasingId, setPurchasingId] = useState<string | null>(null);
    const [confirmProduct, setConfirmProduct] = useState<StoreProduct | null>(null);

    const load = async () => {
        try {
            const [storeRes, purchasesRes, balanceRes] = await Promise.all([
                fetch("/api/store"),
                fetch("/api/store/purchases"),
                fetch("/api/user/balance"),
            ]);

            if (storeRes.ok) setProducts(await storeRes.json());
            if (purchasesRes.ok) setPurchases(await purchasesRes.json());
            if (balanceRes.ok) {
                const b = await balanceRes.json();
                setBalance(b.balance);
            }
        } catch {
            toast.error(t("loadError"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openPurchaseConfirm = (product: StoreProduct) => {
        if (product.isPurchased) return;

        if (balance < product.price) {
            toast.error(t("insufficientBalance"));
            return;
        }

        setConfirmProduct(product);
    };

    const confirmPurchase = async () => {
        if (!confirmProduct) return;

        const product = confirmProduct;
        setConfirmProduct(null);
        setPurchasingId(product.id);

        try {
            const res = await fetch(`/api/store/${product.id}/purchase`, {
                method: "POST",
            });

            if (res.ok) {
                const data = await res.json();
                setBalance(data.newBalance);
                toast.success(t("purchaseSuccess"));
                load();
            } else {
                const err = await res.text();
                if (err.includes("Insufficient balance")) {
                    toast.error(t("insufficient"));
                } else if (err.includes("already purchased")) {
                    toast.error(t("alreadyPurchased"));
                    load();
                } else {
                    toast.error(err || t("purchaseFailed"));
                }
            }
        } catch {
            toast.error(t("purchaseFailed"));
        } finally {
            setPurchasingId(null);
        }
    };

    return (
        <div className="p-6 space-y-6 w-full text-start" dir={dir}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 justify-start">
                    <ShoppingBag className="h-8 w-8 shrink-0" />
<h1 className="text-2xl font-bold">{t("store")}</h1>
                </div>
                <Card className="px-4 py-2 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2 text-sm justify-start">
                        <Wallet className="h-4 w-4 text-primary shrink-0" />
<span>{t("yourBalance")}</span>
<span className="font-semibold">{tCommon("egpAmount", { amount: balance.toFixed(2) })}</span>
                        <Button variant="link" size="sm" asChild className="p-0 h-auto">
<Link href="/dashboard/balance">{t("topUp")}</Link>
                        </Button>
                    </div>
                </Card>
            </div>

<Tabs defaultValue="shop" dir={dir} className="w-full">
                <TabsList className="w-full flex justify-start h-auto">
<TabsTrigger value="shop">{t("store")}</TabsTrigger>
<TabsTrigger value="purchases">{t("myPurchases", { count: purchases.length })}</TabsTrigger>
                </TabsList>

                <TabsContent value="shop" className="mt-6 w-full">
                    {loading ? (
<p className="text-muted-foreground">{tCommon("loading")}</p>
                    ) : products.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
{t("noProductsAvailable")}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                            {products.map((p) => (
                                <Card key={p.id} className="overflow-hidden text-right">
                                    <div className="relative aspect-video bg-muted">
                                        <Image
                                            src={p.imageUrl || "/placeholder.png"}
                                            alt={localizedField(p as unknown as Record<string, unknown>, "title", locale)}
                                            fill
                                            className="object-cover"
                                        />
                                        {p.isPurchased && (
<Badge className="absolute top-2 start-2">{t("purchased")}</Badge>
                                        )}
                                    </div>
                                    <CardHeader className="text-right">
                                        <CardTitle className="text-lg line-clamp-2 text-right">
                                            {localizedField(p as unknown as Record<string, unknown>, "title", locale)}
                                        </CardTitle>
                                        {p.description && (
                                            <CardDescription className="line-clamp-2 text-right">
                                                {localizedField(p as unknown as Record<string, unknown>, "description", locale)}
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-right">
                                        <p className="text-lg font-semibold text-primary">
                                            {formatPrice(p.price)}
                                        </p>
                                        {p.isPurchased ? (
                                            <Button variant="secondary" className="w-full" asChild>
                                                <a
                                                    href={
                                                        purchases.find((x) => x.product.id === p.id)
                                                            ?.product.downloadUrl ?? "#"
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-2"
                                                >
                                                    <Download className="h-4 w-4 shrink-0" />
{t("openDownload")}
                                                </a>
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full"
                                                disabled={purchasingId === p.id}
                                                onClick={() => openPurchaseConfirm(p)}
                                            >
{purchasingId === p.id ? t("purchasing") : t("buy")}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="purchases" className="mt-6 w-full">
                    {loading ? (
                        <p className="text-muted-foreground">{tCommon("loading")}</p>
                    ) : purchases.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
{t("noPurchasesYet")}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4 w-full">
                            {purchases.map((row) => (
                                <Card key={row.id} className="text-right">
                                    <CardContent className="flex flex-wrap items-center gap-4 p-4 justify-between">
                                        <div className="flex items-center gap-4 flex-1 min-w-0 justify-start">
                                            {row.product.imageUrl && (
                                                <div className="relative w-20 h-20 rounded overflow-hidden shrink-0">
                                                    <Image
                                                        src={row.product.imageUrl}
                                                        alt=""
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            )}
                                            <div className="min-w-0 text-right">
                                                <h3 className="font-semibold">{localizedField(row.product as unknown as Record<string, unknown>, "title", locale)}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatPrice(row.pricePaid)} —{" "}
                                                    {new Date(row.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild className="shrink-0">
                                            <a
                                                href={row.product.downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2"
                                            >
                                                <ExternalLink className="h-4 w-4 shrink-0" />
{t("openLink")}
                                            </a>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <AlertDialog
                open={!!confirmProduct}
                onOpenChange={(open) => {
                    if (!open) setConfirmProduct(null);
                }}
            >
<AlertDialogContent className="text-start" dir={dir}>
                    <AlertDialogHeader>
<AlertDialogTitle>{t("confirmPurchaseTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmProduct && (
                                <>
                                    {t("confirmPurchaseDesc", {
                                        title: localizedField(confirmProduct as unknown as Record<string, unknown>, "title", locale),
                                        price: formatPrice(confirmProduct.price),
                                    })}
                                    <br />
                                    <span className="text-muted-foreground">
                                        {t("willDeduct", { balance: balance.toFixed(2) })}
                                    </span>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-start">
                        <AlertDialogAction
                            onClick={confirmPurchase}
                            disabled={!!purchasingId}
                        >
{purchasingId ? t("confirming") : t("confirmPurchase")}
                        </AlertDialogAction>
<AlertDialogCancel disabled={!!purchasingId}>{tCommon("cancel")}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
