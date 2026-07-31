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
import { useTranslations } from "next-intl";

type StoreProduct = {
    id: string;
    title: string;
    titleEn?: string | null;
    description: string | null;
    descriptionEn?: string | null;
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
    titleEn: string;
    description: string;
    descriptionEn: string;
    imageUrl: string;
    price: string;
    downloadUrl: string;
    isPublished: boolean;
    position: string;
};

const emptyForm: FormState = {
    title: "",
    titleEn: "",
    description: "",
    descriptionEn: "",
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
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const t = useTranslations("editor.store");
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
                toast.error(t("loadFailed"));
            }
        } catch {
            toast.error(t("loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            titleEn: p.titleEn ?? "",
            description: p.description ?? "",
            descriptionEn: p.descriptionEn ?? "",
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
                titleEn: form.titleEn.trim() || null,
                description: form.description.trim() || null,
                descriptionEn: form.descriptionEn.trim() || null,
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
                toast.success(editingId ? t("updated") : t("created"));
                setDialogOpen(false);
                fetchProducts();
            } else {
                const err = await res.text();
                toast.error(err || t("error"));
            }
        } catch {
            toast.error(t("error"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("confirmDelete"))) return;
        try {
            const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("deleted"));
                fetchProducts();
            } else {
                toast.error(t("deleteFailed"));
            }
        } catch {
            toast.error(t("deleteFailed"));
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-8 w-8" />
                    <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("addProduct")}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("products")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-muted-foreground">{t("loading")}</p>
                    ) : products.length === 0 ? (
                        <p className="text-muted-foreground">{t("noProducts")}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-start">{t("product")}</TableHead>
                                    {showCreator && (
                                        <TableHead className="text-start">{t("creator")}</TableHead>
                                    )}
                                    <TableHead className="text-start">{t("price")}</TableHead>
                                    <TableHead className="text-start">{t("sales")}</TableHead>
                                    <TableHead className="text-start">{t("status")}</TableHead>
                                    <TableHead className="text-start">{t("actions")}</TableHead>
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
                                                {p.isPublished ? tCommon("published") : tCommon("draft")}
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
                            {editingId ? t("editProduct") : t("newProduct")}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="title">{tCommon("arabicLabel")} — {t("title")}</Label>
                            <Input
                                id="title"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="titleEn">{tCommon("englishLabel")} — {tEditor("titleEn")}</Label>
                            <Input
                                id="titleEn"
                                dir="ltr"
                                value={form.titleEn}
                                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">{tCommon("arabicLabel")} — {t("description")}</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label htmlFor="descriptionEn">{tCommon("englishLabel")} — {tEditor("descriptionEn")}</Label>
                            <Textarea
                                id="descriptionEn"
                                dir="ltr"
                                value={form.descriptionEn}
                                onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label htmlFor="price">{t("priceEgp")}</Label>
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
                            <Label htmlFor="downloadUrl">{t("downloadUrl")}</Label>
                            <Input
                                id="downloadUrl"
                                value={form.downloadUrl}
                                onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
                                placeholder="https://..."
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <Label>{t("productImage")}</Label>
                            {form.imageUrl && (
                                <div className="relative w-full h-32 mb-2 rounded border overflow-hidden">
                                    <Image src={form.imageUrl} alt="" fill className="object-cover" />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-2 start-2"
                                        onClick={() => setForm({ ...form, imageUrl: "" })}
                                    >
                                        {t("remove")}
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
                            <Label htmlFor="position">{t("position")}</Label>
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
                                {t("publishInStore")}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            {t("cancel")}
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? t("saving") : t("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
