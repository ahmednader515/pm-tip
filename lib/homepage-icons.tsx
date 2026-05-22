import { Star, Users, Award, BookOpen, Book } from "lucide-react";
import type { HomepageFeatureIcon } from "@/lib/homepage";

export function HomepageFeatureIconComponent({
    icon,
    className,
}: {
    icon: HomepageFeatureIcon;
    className?: string;
}) {
    const props = { className: className ?? "h-6 w-6 text-brand" };
    switch (icon) {
        case "users":
            return <Users {...props} />;
        case "award":
            return <Award {...props} />;
        case "book":
            return <Book {...props} />;
        case "bookopen":
            return <BookOpen {...props} />;
        case "star":
        default:
            return <Star {...props} />;
    }
}
