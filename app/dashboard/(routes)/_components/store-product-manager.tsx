"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { FileUpload } from "@/components/file-upload";
import Image from "next/image";

type StoreProduct = {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    downloadUrl: string;
    isPublished: boolean;
    position: number;
    user?: { id: string; fullName: string };
    _count?: { purchases: number };
};

type FormState = {
    title: string;
    description: string;
    imageUrl: string;
    price: string;
    downloadUrl: string;
    isPublished: boolean;
    position: string;
};

const emptyForm: FormState = {
    title: "",
    description: "",
    imageUrl: "",
    price: "",
    downloadUrl: "",
    isPublished: false,
    position: "0",
};

export function StoreProductManager({
    apiBase,
    showCreator = false,
}: {
    apiBase: "/api/admin/store" | "/api/teacher/store";
    showCreator?: boolean;
}) {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);

    const fetchProducts = async () => {
        try {
            const res = await fetch(apiBase);
            if (res.ok) {
                setProducts(await res.json());
            } else {
                toast.error("حدث خطأ في تحميل المنتجات");
            }
        } catch {
            toast.error("حدث خطأ في تحميل المنتجات");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [apiBase]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (p: StoreProduct) => {
        setEditingId(p.id);
        setForm({
            title: p.title,
            description: p.description ?? "",
            imageUrl: p.imageUrl ?? "",
            price: String(p.price),
            downloadUrl: p.downloadUrl,
            isPublished: p.isPublished,
            position: String(p.position),
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                imageUrl: form.imageUrl.trim() || null,
                price: parseFloat(form.price),
                downloadUrl: form.downloadUrl.trim(),
                isPublished: form.isPublished,
                position: parseInt(form.position, 10) || 0,
            };

            const url = editingId ? `${apiBase}/${editingId}` : apiBase;
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingId ? "تم تحديث المنتج" : "تم إضافة المنتج");
                setDialogOpen(false);
                fetchProducts();
            } else {
                const err = await res.text();
                toast.error(err || "حدث خطأ");
            }
        } catch {
            toast.error("حدث خطأ");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
        try {
            const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("تم حذف المنتج");
                fetchProducts();
            } else {
                toast.error("فشل حذف المنتج");
            }
        } catch {
            toast.error("فشل حذف المنتج");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-8 w-8" />
                    <h1 className="text-2xl font-bold">إدارة المتجر</h1>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة منتج
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-muted-foreground">جاري التحميل...</p>
                    ) : products.length === 0 ? (
                        <p className="text-muted-foreground">لا توجد منتجات بعد</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">المنتج</TableHead>
                                    {showCreator && (
                                        <TableHead className="text-right">المنشئ</TableHead>
                                    )}
                                    <TableHead className="text-right">السعر</TableHead>
                                    <TableHead className="text-right">المبيعات</TableHead>
                                    <TableHead className="text-right">الحالة</TableHead>
                                    <TableHead className="text-right">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {p.imageUrl && (
                                                    <Image
                                                        src={p.imageUrl}
                                                        alt=""
                                                        width={40}
                                                        height={40}
                                                        className="rounded object-cover shrink-0"
                                                    />
                                                )}
                                                <span className="font-medium line-clamp-1">{p.title}</span>
                                            </div>
                                        </TableCell>
                                        {showCreator && (
                                            <TableCell>{p.user?.fullName ?? "—"}</TableCell>
                                        )}
                                        <TableCell>{formatPrice(p.price)}</TableCell>
                                        <TableCell>{p._count?.purchases ?? 0}</TableCell>
                                        <TableCell>
                                            <Badge variant={p.isPublished ? "default" : "secondary"}>
                                                {p.isPublished ? "منشور" : "مسودة"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => openEdit(p)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => handleDelete(p.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? "تعديل منتج" : "إضافة منتج جديد"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="title">العنوان</Label>
                            <Input
                                id="title"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">الوصف</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label htmlFor="price">السعر (جنيه)</Label>
                            <Input
                                id="price"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="downloadUrl">رابط التحميل</Label>
                            <Input
                                id="downloadUrl"
                                value={form.downloadUrl}
                                onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
                                placeholder="https://..."
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <Label>صورة المنتج</Label>
                            {form.imageUrl && (
                                <div className="relative w-full h-32 mb-2 rounded border overflow-hidden">
                                    <Image src={form.imageUrl} alt="" fill className="object-cover" />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-2 left-2"
                                        onClick={() => setForm({ ...form, imageUrl: "" })}
                                    >
                                        إزالة
                                    </Button>
                                </div>
                            )}
                            <FileUpload
                                endpoint="courseImage"
                                onChange={(res) => {
                                    if (res?.url) setForm({ ...form, imageUrl: res.url });
                                }}
                            />
                        </div>
                        <div>
                            <Label htmlFor="position">الترتيب</Label>
                            <Input
                                id="position"
                                type="number"
                                min={0}
                                value={form.position}
                                onChange={(e) => setForm({ ...form, position: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="published"
                                checked={form.isPublished}
                                onCheckedChange={(v) =>
                                    setForm({ ...form, isPublished: v === true })
                                }
                            />
                            <Label htmlFor="published" className="cursor-pointer">
                                نشر في المتجر
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "جاري الحفظ..." : "حفظ"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
