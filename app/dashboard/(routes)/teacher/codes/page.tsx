"use client";

import { useLocale, useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Plus, Copy, Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Course {
  id: string;
  title: string;
  isPublished: boolean;
}

interface PurchaseCode {
  id: string;
  code: string;
  courseId: string;
  discountPercent: number;
  isUsed: boolean;
  usedAt: string | null;
  createdAt: string;
  course: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
  } | null;
}

const TeacherCodesPage = () => {
    const t = useTranslations("dashboard.teacher.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const dateLocale = locale === "ar" ? ar : enUS;

  const [codes, setCodes] = useState<PurchaseCode[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [codeCount, setCodeCount] = useState<string>("1");
  const [discountPercent, setDiscountPercent] = useState<string>("100");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();
    fetchCourses();
  }, []);

  const fetchCodes = async () => {
    try {
      const response = await fetch("/api/teacher/codes");
      if (response.ok) {
        const data = await response.json();
        setCodes(data);
      } else {
        toast.error(t("loadCodesError"));
      }
    } catch (error) {
      console.error("Error fetching codes:", error);
      toast.error(t("loadCodesError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch("/api/courses");
      if (response.ok) {
        const data = await response.json();
        // Filter only published courses
        const publishedCourses = data.filter((course: Course) => course.isPublished);
        setCourses(publishedCourses);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const handleGenerateCodes = async () => {
    if (!selectedCourse || !codeCount || parseInt(codeCount) < 1 || parseInt(codeCount) > 100) {
      toast.error(t("selectCourseAndCount"));
      return;
    }
    const d = parseInt(discountPercent, 10);
    if (Number.isNaN(d) || d < 0 || d > 100) {
      toast.error(t("discountRangeError"));
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/teacher/codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: selectedCourse,
          count: parseInt(codeCount),
          discountPercent: d,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t("codesCreatedSuccess", { count: data.count }));
        setIsDialogOpen(false);
        setSelectedCourse("");
        setCodeCount("1");
        setDiscountPercent("100");
        fetchCodes(); // Refresh the list
      } else {
        const error = await response.text();
        toast.error(error || t("codesCreateError"));
      }
    } catch (error) {
      console.error("Error generating codes:", error);
      toast.error(t("codesCreateError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(t("codeCopied"));
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error(t("codeCopyFailed"));
    }
  };

  const filteredCodes = codes.filter((code) => {
    const matchesSearch =
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.course.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === "all" || code.courseId === courseFilter;
    return matchesSearch && matchesCourse;
  });

  const usedCodes = filteredCodes.filter((code) => code.isUsed);
  const unusedCodes = filteredCodes.filter((code) => !code.isUsed);

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("codesTitle")}</h1>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-brand hover:bg-brand/90">
          <Plus className="h-4 w-4 ml-2" />{t("createCodes")}</Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchCodesShort")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="course-filter" className="whitespace-nowrap">{tCommon("filterByCourse")}</Label>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger id="course-filter" className="w-[250px]">
                  <SelectValue placeholder={tCommon("allCourses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon("allCourses")}</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("totalCodes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCodes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("unusedCodes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{unusedCodes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("usedCodes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{usedCodes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("codesList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("noCodes")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("code")}</TableHead>
                  <TableHead className="text-right">{tCommon("course")}</TableHead>
                  <TableHead className="text-right">{t("discountPercent")}</TableHead>
                  <TableHead className="text-right">{tCommon("status")}</TableHead>
                  <TableHead className="text-right">{tCommon("userLabel")}</TableHead>
                  <TableHead className="text-right">{t("usedAt")}</TableHead>
                  <TableHead className="text-right">{tCommon("createdAtLabel")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyCode(code.code)}
                          className="h-6 w-6 p-0"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{code.course.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{code.discountPercent ?? 100}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.isUsed ? "secondary" : "default"}>
                        {code.isUsed ? tCommon("used") : tCommon("unused")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {code.user ? (
                        <div>
                          <div className="font-medium">{code.user.fullName}</div>
                          <div className="text-sm text-muted-foreground">{code.user.phoneNumber}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {code.usedAt
                        ? format(new Date(code.usedAt), "yyyy-MM-dd HH:mm", { locale: dateLocale })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(code.createdAt), "yyyy-MM-dd HH:mm", { locale: dateLocale })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(code.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Codes Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createCodes")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="course" className="mb-2 block">{tCommon("course")}</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder={tCommon("selectCourse")} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="count" className="mb-2 block">{t("codeCount")}</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                value={codeCount}
                onChange={(e) => setCodeCount(e.target.value)}
                placeholder="1-100"
              />
            </div>
            <div>
              <Label htmlFor="discount" className="mb-2 block">{t("discountPercentLabel")}</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder={t("discountPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("discountHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{tCommon("cancel")}</Button>
            <Button
              onClick={handleGenerateCodes}
              disabled={isGenerating || !selectedCourse || !codeCount}
              className="bg-brand hover:bg-brand/90"
            >
              {isGenerating ? tCommon("creating") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherCodesPage;

