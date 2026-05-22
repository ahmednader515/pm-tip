"use client";

import Link from "next/link";
import Image from "next/image";
import { useHomepageSettings } from "@/components/homepage-settings-provider";
import { cn } from "@/lib/utils";

type HeaderLogoProps = {
    className?: string;
    sizes?: string;
    asLink?: boolean;
    alt?: string;
};

export function HeaderLogo({
    className = "relative w-10 h-10 md:w-12 md:h-12 shrink-0",
    sizes = "48px",
    asLink = false,
    alt = "logo",
}: HeaderLogoProps) {
    const { headerLogoUrl } = useHomepageSettings();

    const content = (
        <div className={cn("relative", className)}>
            <Image
                fill
                alt={alt}
                src={headerLogoUrl}
                className="object-contain"
                unoptimized={headerLogoUrl.startsWith("/")}
                sizes={sizes}
            />
        </div>
    );

    if (asLink) {
        return (
            <Link href="/" className="flex items-center shrink-0">
                {content}
            </Link>
        );
    }

    return content;
}
