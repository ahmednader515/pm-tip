"use client";

import { useLocale, useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Search, Eye, Award, TrendingUp, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Course {
    id: string;
    title: string;
}

interface Quiz {
    id: string;
    title: string;
    courseId: string;
    course: {
        title: string;
    };
    totalPoints: number;
}

interface QuizResult {
    id: string;
    studentId: string;
    user: {
        fullName: string;
        phoneNumber: string;
    };
    quizId: string;
    quiz: {
        title: string;
        course: {
            id: string;
            title: string;
        };
        totalPoints: number;
    };
    score: number;
    totalPoints: number;
    percentage: number;
    submittedAt: string;
    answers: QuizAnswer[];
}

interface QuizAnswer {
    questionId: string;
    question: {
        text: string;
        type: string;
        points: number;
    };
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    pointsEarned: number;
}

const GradesPage = () => {
    const t = useTranslations("dashboard.teacher.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const dateLocale = locale === "ar" ? ar : enUS;

    const [courses, setCourses] = useState<Course[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCourse, setSelectedCourse] = useState<string>("");
    const [selectedQuiz, setSelectedQuiz] = useState<string>("");
    const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        fetchCourses();
        fetchQuizzes();
        fetchQuizResults();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await fetch("/api/courses");
            if (response.ok) {
                const data = await response.json();
                setCourses(data);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const fetchQuizzes = async () => {
        try {
            const response = await fetch("/api/teacher/quizzes");
            if (response.ok) {
                const data = await response.json();
                setQuizzes(data);
            }
        } catch (error) {
            console.error("Error fetching quizzes:", error);
        }
    };

    const fetchQuizResults = async () => {
        try {
            const response = await fetch("/api/teacher/quiz-results");
            if (response.ok) {
                const data = await response.json();
                setQuizResults(data);
            }
        } catch (error) {
            console.error("Error fetching quiz results:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewResult = (result: QuizResult) => {
        setSelectedResult(result);
        setIsDialogOpen(true);
    };

    const filteredResults = quizResults.filter(result => {
        const matchesSearch = 
            result.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            result.quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            result.quiz.course.title.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCourse = !selectedCourse || selectedCourse === "all" || result.quiz.course.id === selectedCourse;
        const matchesQuiz = !selectedQuiz || selectedQuiz === "all" || result.quizId === selectedQuiz;
        
        return matchesSearch && matchesCourse && matchesQuiz;
    });

    const getGradeColor = (percentage: number) => {
        if (percentage >= 90) return "text-green-600";
        if (percentage >= 80) return "text-green-500";
        if (percentage >= 70) return "text-green-400";
        if (percentage >= 60) return "text-orange-600";
        return "text-red-600";
    };

    const getGradeBadge = (percentage: number) => {
        if (percentage >= 90) return { variant: "default" as const, className: "bg-green-600 text-white" };
        if (percentage >= 80) return { variant: "default" as const, className: "bg-green-500 text-white" };
        if (percentage >= 70) return { variant: "default" as const, className: "bg-green-400 text-white" };
        if (percentage >= 60) return { variant: "default" as const, className: "bg-orange-600 text-white" };
        return { variant: "destructive" as const, className: "" };
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("gradesStudentsTitle")}</h1>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                            <Users className="h-8 w-8 text-blue-600" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{t("totalStudents")}</p>
                                <p className="text-2xl font-bold">
                                    {new Set(quizResults.map(r => r.studentId)).size}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                            <Award className="h-8 w-8 text-green-600" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{t("averageScore")}</p>
                                <p className="text-2xl font-bold">
                                    {quizResults.length > 0 
                                        ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length)
                                        : 0}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="h-8 w-8 text-purple-600" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{t("highest")}</p>
                                <p className="text-2xl font-bold">
                                    {quizResults.length > 0 
                                        ? Math.max(...quizResults.map(r => r.percentage))
                                        : 0}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                            <FileText className="h-8 w-8 text-orange-600" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{t("totalQuizzesAttempts")}</p>
                                <p className="text-2xl font-bold">{quizResults.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("searchFilters")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("searchLabel")}</label>
                            <div className="flex items-center space-x-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t("searchByStudentOrQuiz")}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{tCommon("course")}</label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                                <SelectTrigger>
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("quizLabel")}</label>
                            <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("allQuizzes")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t("allQuizzes")}</SelectItem>
                                    {quizzes.map((quiz) => (
                                        <SelectItem key={quiz.id} value={quiz.id}>
                                            {quiz.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("quizResults")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">{tCommon("studentLabel")}</TableHead>
                                <TableHead className="text-right">{t("quizLabel")}</TableHead>
                                <TableHead className="text-right">{tCommon("course")}</TableHead>
                                <TableHead className="text-right">{tCommon("score")}</TableHead>
                                <TableHead className="text-right">{t("percentageCol")}</TableHead>
                                <TableHead className="text-right">{t("submittedDate")}</TableHead>
                                <TableHead className="text-right">{tCommon("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.map((result) => {
                                const gradeBadge = getGradeBadge(result.percentage);
                                return (
                                    <TableRow key={result.id}>
                                        <TableCell className="font-medium">
                                            {result.user.fullName}
                                        </TableCell>
                                        <TableCell>
                                            {result.quiz.title}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {result.quiz.course.title}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold">
                                                {result.score}/{result.totalPoints}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge {...gradeBadge}>
                                                {result.percentage}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(result.submittedAt), "dd/MM/yyyy", { locale: dateLocale })}
                                        </TableCell>
                                        <TableCell>
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => handleViewResult(result)}
                                            >
                                                <Eye className="h-4 w-4" />
                                                {t("viewDetails")}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Result Details Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {t("resultDetailsFor", { name: selectedResult?.user.fullName })}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedResult && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("resultSummary")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {selectedResult.score}/{selectedResult.totalPoints}
                                            </div>
                                            <div className="text-sm text-muted-foreground">{tCommon("score")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-2xl font-bold ${getGradeColor(selectedResult.percentage)}`}>
                                                {selectedResult.percentage}%
                                            </div>
                                            <div className="text-sm text-muted-foreground">{t("percentageCol")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {selectedResult.answers.filter(a => a.isCorrect).length}
                                            </div>
                                            <div className="text-sm text-muted-foreground">{t("correctAnswers")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-red-600">
                                                {selectedResult.answers.filter(a => !a.isCorrect).length}
                                            </div>
                                            <div className="text-sm text-muted-foreground">{t("wrongAnswers")}</div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium">{t("overallProgress")}</span>
                                            <span className="text-sm font-medium">{selectedResult.percentage}%</span>
                                        </div>
                                        <Progress value={selectedResult.percentage} className="w-full" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Detailed Answers */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("answerDetails")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {selectedResult.answers.map((answer, index) => (
                                            <div key={answer.questionId} className="border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium">{t("questionN", { n: index + 1 })}</h4>
                                                    <Badge variant={answer.isCorrect ? "default" : "destructive"}>
                                                        {answer.isCorrect ? t("correct") : t("incorrectAlt")}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-2">{answer.question.text}</p>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="font-medium">{t("studentAnswerColon")}</span>
                                                        <p className="text-muted-foreground">{answer.studentAnswer}</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">{t("correctAnswerColon")}</span>
                                                        <p className="text-green-600">{answer.correctAnswer}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-sm">
                                                    <span className="font-medium">{t("pointsColon")}</span>
                                                    <span className="text-muted-foreground">
                                                        {" "}{answer.pointsEarned}/{answer.question.points}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GradesPage; 