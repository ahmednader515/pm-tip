"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Chapter, Quiz } from "@prisma/client";
import { Grip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface CourseItem {
    id: string;
    title: string;
    position: number;
    isPublished: boolean;
    type: "chapter" | "quiz";
    isFree?: boolean; // Only for chapters
}

interface CourseContentListProps {
    items: CourseItem[];
    onReorder: (updateData: { id: string; position: number; type: "chapter" | "quiz" }[]) => void;
    onEdit: (id: string, type: "chapter" | "quiz") => void;
    onDelete: (id: string, type: "chapter" | "quiz") => void;
}

export const CourseContentList = ({
    items,
    onReorder,
    onEdit,
    onDelete
}: CourseContentListProps) => {
    const tCommon = useTranslations("common");
    const tCourse = useTranslations("course");
    const t = useTranslations("dashboard.teacher.courseEditor");

    const getActionLabel = (type: "chapter" | "quiz", isPublished: boolean) => {
        if (type === "chapter") {
            return isPublished ? t("editVideoAction") : t("addVideoAction");
        }
        return isPublished ? t("editQuizAction") : t("addQuizAction");
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const reorderedItems = Array.from(items);
        const [movedItem] = reorderedItems.splice(result.source.index, 1);
        reorderedItems.splice(result.destination.index, 0, movedItem);

        const updateData = reorderedItems.map((item, index) => ({
            id: item.id,
            position: index + 1,
            type: item.type,
        }));

        onReorder(updateData);
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="course-content">
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                        {items.map((item, index) => (
                            <Draggable 
                                key={item.id} 
                                draggableId={item.id} 
                                index={index}
                            >
                                {(provided) => (
                                    <div
                                        className={cn(
                                            "flex items-center gap-x-2 bg-muted border-muted text-muted-foreground rounded-md mb-4 text-sm",
                                            item.isPublished && "bg-primary/20 border-primary/20"
                                        )}
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                    >
                                        <div
                                            className={cn(
                                                "px-2 py-3 border-r border-r-muted hover:bg-muted rounded-l-md transition",
                                                item.isPublished && "border-r-primary/20"
                                            )}
                                            {...provided.dragHandleProps}
                                        >
                                            <Grip className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 px-2">
                                            <div className="flex items-center gap-x-2">
                                                <span>{item.title}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {item.type === "chapter" ? tCommon("chapter") : tCommon("quiz")}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="ml-auto pr-2 flex items-center gap-x-2">
                                                                                         {item.type === "chapter" && item.isFree && (
                                                 <Badge>
                                                     {tCourse("free")}
                                                 </Badge>
                                             )}
                                            <Badge
                                                className={cn(
                                                    "bg-muted text-muted-foreground",
                                                    item.isPublished && "bg-primary text-primary-foreground"
                                                )}
                                            >
                                                {item.isPublished ? tCommon("published") : tCommon("draft")}
                                            </Badge>
                                            <button
                                                onClick={() => onEdit(item.id, item.type)}
                                                className="text-brand text-xs font-semibold hover:underline transition"
                                            >
                                                {getActionLabel(item.type, item.isPublished)}
                                            </button>
                                            <Trash2
                                                onClick={() => onDelete(item.id, item.type)}
                                                className="w-4 h-4 cursor-pointer hover:opacity-75 transition"
                                            />
                                        </div>
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}; 