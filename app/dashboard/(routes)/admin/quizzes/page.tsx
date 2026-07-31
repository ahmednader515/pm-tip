"use client";

import { useLocale, useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigationRouter } from "@/lib/hooks/use-navigation-router";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface Quiz {
  id: string;
  title: string;
  titleEn?: string | null;
  description: string;
  courseId: string;
  position: number;
  isPublished: boolean;
  course: { id: string; title: string; titleEn?: string | null };
  questions: { id: string }[];
  createdAt: string;
}

export default function AdminQuizzesPage() {
    const t = useTranslations("dashboard.admin.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale() as Locale;

  const router = useNavigationRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await fetch("/api/admin/quizzes");
        if (response.ok) {
          const data = await response.json();
          setQuizzes(data);
        } else {
          toast.error(t("loadQuizzesError"));
        }
      } catch (e) {
        toast.error(t("loadError"));
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  const filteredQuizzes = quizzes.filter((quiz) =>
    [quiz.title, quiz.course.title].some((value) =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleViewQuiz = (quiz: Quiz) => {
    router.push(`/dashboard/teacher/quizzes/${quiz.id}`);
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    setPublishingId(quiz.id);
    try {
      const response = await fetch(`/api/teacher/quizzes/${quiz.id}/publish`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublished: !quiz.isPublished }),
      });

      if (!response.ok) {
        throw new Error(t("publishUpdateError"));
      }

      toast.success(quiz.isPublished ? t("unpublishSuccess") : t("publishSuccess"));
      setQuizzes((prev) =>
        prev.map((item) =>
          item.id === quiz.id ? { ...item, isPublished: !quiz.isPublished } : item
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (quizId: string, quizTitle: string) => {
    const confirmed = window.confirm(t("deleteQuizConfirm", { title: quizTitle }));
    if (!confirmed) {
      return;
    }

    setDeletingId(quizId);
    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || t("deleteQuizError"));
      }

      setQuizzes((previous) => previous.filter((quiz) => quiz.id !== quizId));
      toast.success(t("deleteQuizSuccess"));
    } catch (error) {
      console.error("[ADMIN_DELETE_QUIZ]", error);
      toast.error(error instanceof Error ? error.message : t("deleteQuizError"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">{tCommon("loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("quizzesTitle")}</h1>
        <Button onClick={() => router.push("/dashboard/admin/quizzes/create")} className="bg-brand hover:bg-brand/90 text-white">
          <Plus className="h-4 w-4" />{t("createQuiz")}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("quizzesCardTitle")}</CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchQuizzes")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">{t("quizTitleCol")}</TableHead>
                <TableHead className="text-right">{tCommon("course")}</TableHead>
                <TableHead className="text-right">{t("position")}</TableHead>
                <TableHead className="text-right">{tCommon("status")}</TableHead>
                <TableHead className="text-right">{t("questionCountCol")}</TableHead>
                <TableHead className="text-right">{tCommon("createdAtLabel")}</TableHead>
                <TableHead className="text-right">{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell className="font-medium">{localizedField(quiz as unknown as Record<string, unknown>, "title", locale)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{localizedField(quiz.course as unknown as Record<string, unknown>, "title", locale)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{quiz.position}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={quiz.isPublished ? "default" : "secondary"}>
                      {quiz.isPublished ? tCommon("published") : tCommon("draft")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tCommon("questionCount", { count: quiz.questions.length })}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(quiz.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                  </TableCell>
                  <TableCell className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      className="bg-brand hover:bg-brand/90 text-white"
                      size="sm"
                      onClick={() => handleViewQuiz(quiz)}
                    >
                      <Eye className="h-4 w-4" />{tCommon("view")}</Button>
                    <Button
                      className="bg-brand hover:bg-brand/90 text-white"
                      size="sm"
                      onClick={() => router.push(`/dashboard/admin/quizzes/${quiz.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />{tCommon("edit")}</Button>
                    <Button
                      variant={quiz.isPublished ? "destructive" : "default"}
                      className={!quiz.isPublished ? "bg-brand hover:bg-brand/90 text-white" : ""}
                      size="sm"
                      disabled={publishingId === quiz.id}
                      onClick={() => handleTogglePublish(quiz)}
                    >
                      {publishingId === quiz.id
                        ? tCommon("updating") : quiz.isPublished
                        ? tCommon("unpublish") : tCommon("publish")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === quiz.id}
                      onClick={() => handleDelete(quiz.id, localizedField(quiz as unknown as Record<string, unknown>, "title", locale))}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === quiz.id ? tCommon("deleting") : tCommon("delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


