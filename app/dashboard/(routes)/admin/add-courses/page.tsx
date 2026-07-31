"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, User, Plus } from "lucide-react";
import { toast } from "sonner";

interface User {
    id: string;
    fullName: string;
    phoneNumber: string;
    role: string;
    _count?: {
        purchases: number;
    };
}

interface Course {
    id: string;
    title: string;
    price: number;
    isPublished: boolean;
}

const AddCoursesPage = () => {
    const t = useTranslations("dashboard.admin.pages");
    const tCommon = useTranslations("common");
    
    const [users, setUsers] = useState<User[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [ownedCourses, setOwnedCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"add" | "delete">("add");
    const [isAddingCourse, setIsAddingCourse] = useState(false);
    const [isDeletingCourse, setIsDeletingCourse] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchCourses();
    }, []);

    useEffect(() => {
        // fetch owned courses when a user is selected for delete mode
        const fetchOwned = async () => {
            if (!selectedUser) {
                setOwnedCourses([]);
                return;
            }
            try {
                const res = await fetch(`/api/admin/users/${selectedUser.id}/courses`);
                if (res.ok) {
                    const data = await res.json();
                    setOwnedCourses(data.courses || []);
                }
            } catch (e) {
                console.error("Error fetching owned courses", e);
            }
        };
        fetchOwned();
    }, [selectedUser]);

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/admin/users");
            if (response.ok) {
                const data = await response.json();
                // Filter only students
                const studentUsers = data.filter((user: User) => user.role === "USER");
                setUsers(studentUsers);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
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

    const handleAddCourse = async () => {
        if (!selectedUser || !selectedCourse) {
            toast.error(t("selectStudentAndCourse"));
            return;
        }

        setIsAddingCourse(true);
        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}/add-course`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ courseId: selectedCourse }),
            });

            if (response.ok) {
                toast.success(t("addCourseSuccess"));
                setIsDialogOpen(false);
                setSelectedUser(null);
                setSelectedCourse("");
            } else {
                const error = await response.json();
                toast.error(error.message || {t("addCourseError")});
            }
        } catch (error) {
            console.error("Error adding course:", error);
            toast.error(t("addCourseError"));
        } finally {
            setIsAddingCourse(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!selectedUser || !selectedCourse) {
            toast.error(t("selectStudentAndCourse"));
            return;
        }

        setIsDeletingCourse(true);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}/add-course`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId: selectedCourse })
            });
            if (res.ok) {
                toast.success(t("removeCourseSuccess"));
                setIsDialogOpen(false);
                setSelectedCourse("");
                setSelectedUser(null);
                fetchUsers();
            } else {
                const data = await res.json().catch(() => ({} as any));
                toast.error((data as any).error || {t("removeCourseError")});
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            toast.error(t("removeCourseError"));
        } finally {
            setIsDeletingCourse(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phoneNumber.includes(searchTerm)
    );

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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("addCoursesTitle")}</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{tCommon("studentsList")}</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={tCommon("searchByNameOrPhone")}
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
                                <TableHead className="text-right">{tCommon("fullName")}</TableHead>
                                <TableHead className="text-right">{tCommon("phoneNumber")}</TableHead>
                                <TableHead className="text-right">{tCommon("role")}</TableHead>
                                <TableHead className="text-right">{tCommon("purchasedCourses")}</TableHead>
                                <TableHead className="text-right">{tCommon("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.fullName}
                                    </TableCell>
                                    <TableCell>{user.phoneNumber}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{tCommon("roleStudent")}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{user._count?.purchases ?? 0}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setDialogMode("add");
                                                    setSelectedCourse("");
                                                    setIsDialogOpen(true);
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />{t("addCourse")}</Button>
                                            <Button 
                                                size="sm" 
                                                variant="destructive"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setDialogMode("delete");
                                                    setSelectedCourse("");
                                                    setIsDialogOpen(true);
                                                }}
                                            >{t("removeCourse")}</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            {/* Single lightweight dialog rendered once */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDialogOpen(false);
                        setSelectedCourse("");
                        setSelectedUser(null);
                        setDialogMode("add");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === "add" ? (
                                <>{t("addCourseFor", { name: selectedUser?.fullName })}</>
                            ) : (
                                <>{t("removeCourseFrom", { name: selectedUser?.fullName })}</>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{tCommon("selectCourse")}</label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                                <SelectTrigger>
                                    <SelectValue placeholder={tCommon("selectCoursePlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(dialogMode === "delete" ? ownedCourses : courses).map((course) => (
                                        <SelectItem key={course.id} value={course.id}>
                                            <div className="flex items-center justify-between w-full">
                                                <span>{course.title}</span>
                                                {tCommon("amountEgp", { amount: typeof course.price === "number" && (
                                                    <Badge variant="outline" className="mr-2">
                                                        {course.price })}
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsDialogOpen(false);
                                    setSelectedCourse("");
                                    setSelectedUser(null);
                                    setDialogMode("add");
                                }}
                            >{tCommon("cancel")}</Button>
                            {dialogMode === "add" ? (
                                <Button 
                                    onClick={handleAddCourse}
                                    disabled={!selectedCourse || isAddingCourse}
                                >
                                    {isAddingCourse ? tCommon("adding") : t("addCourseBtn")}
                                </Button>
                            ) : (
                                <Button 
                                    variant="destructive"
                                    onClick={handleDeleteCourse}
                                    disabled={!selectedCourse || isDeletingCourse}
                                >
                                    {isDeletingCourse ? tCommon("deleting") : t("removeCourse")}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddCoursesPage; 