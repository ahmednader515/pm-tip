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

type StoreProduct = {
    id: string;
    title: string;
    description: string | null;
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
        description: string | null;
        imageUrl: string | null;
        price: number;
        downloadUrl: string;
    };
};

export function StoreClient() {
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
            toast.error("حدث خطأ في تحميل المتجر");
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
            toast.error("رصيد غير كافٍ. يرجى شحن الرصيد أولاً.");
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
                toast.success("تم الشراء بنجاح!");
                load();
            } else {
                const err = await res.text();
                if (err.includes("Insufficient balance")) {
                    toast.error("رصيد غير كافٍ");
                } else if (err.includes("already purchased")) {
                    toast.error("لقد اشتريت هذا المنتج مسبقاً");
                    load();
                } else {
                    toast.error(err || "فشل الشراء");
                }
            }
        } catch {
            toast.error("فشل الشراء");
        } finally {
            setPurchasingId(null);
        }
    };

    return (
        <div className="p-6 space-y-6 w-full text-right" dir="rtl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 justify-start">
                    <ShoppingBag className="h-8 w-8 shrink-0" />
                    <h1 className="text-2xl font-bold">المتجر</h1>
                </div>
                <Card className="px-4 py-2 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2 text-sm justify-start">
                        <Wallet className="h-4 w-4 text-primary shrink-0" />
                        <span>رصيدك:</span>
                        <span className="font-semibold">{balance.toFixed(2)} جنيه</span>
                        <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link href="/dashboard/balance">شحن الرصيد</Link>
                        </Button>
                    </div>
                </Card>
            </div>

            <Tabs defaultValue="shop" dir="rtl" className="w-full">
                <TabsList className="w-full flex justify-start h-auto">
                    <TabsTrigger value="shop">المتجر</TabsTrigger>
                    <TabsTrigger value="purchases">مشترياتي ({purchases.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="shop" className="mt-6 w-full">
                    {loading ? (
                        <p className="text-muted-foreground">جاري التحميل...</p>
                    ) : products.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                لا توجد منتجات متاحة حالياً
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                            {products.map((p) => (
                                <Card key={p.id} className="overflow-hidden text-right">
                                    <div className="relative aspect-video bg-muted">
                                        <Image
                                            src={p.imageUrl || "/placeholder.png"}
                                            alt={p.title}
                                            fill
                                            className="object-cover"
                                        />
                                        {p.isPurchased && (
                                            <Badge className="absolute top-2 start-2">مُشترى</Badge>
                                        )}
                                    </div>
                                    <CardHeader className="text-right">
                                        <CardTitle className="text-lg line-clamp-2 text-right">
                                            {p.title}
                                        </CardTitle>
                                        {p.description && (
                                            <CardDescription className="line-clamp-2 text-right">
                                                {p.description}
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
                                                    فتح رابط التحميل
                                                </a>
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full"
                                                disabled={purchasingId === p.id}
                                                onClick={() => openPurchaseConfirm(p)}
                                            >
                                                {purchasingId === p.id ? "جاري الشراء..." : "شراء"}
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
                        <p className="text-muted-foreground">جاري التحميل...</p>
                    ) : purchases.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                لم تشترِ أي منتجات بعد
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
                                                <h3 className="font-semibold">{row.product.title}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatPrice(row.pricePaid)} —{" "}
                                                    {new Date(row.createdAt).toLocaleDateString("ar-SA")}
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
                                                فتح الرابط
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
                <AlertDialogContent className="text-right" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الشراء</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmProduct && (
                                <>
                                    هل تريد شراء &quot;{confirmProduct.title}&quot; مقابل{" "}
                                    <span className="font-semibold text-foreground">
                                        {formatPrice(confirmProduct.price)}
                                    </span>
                                    ؟
                                    <br />
                                    <span className="text-muted-foreground">
                                        سيتم خصم المبلغ من رصيدك الحالي ({balance.toFixed(2)} جنيه).
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
                            {purchasingId ? "جاري الشراء..." : "تأكيد الشراء"}
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={!!purchasingId}>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
