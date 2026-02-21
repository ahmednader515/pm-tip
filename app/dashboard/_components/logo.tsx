import Image from "next/image";

export const Logo = () => {
    return (
        <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0">
            <Image
                fill
                alt="logo"
                src="/logo.png"
                className="object-contain"
                unoptimized
                sizes="48px"
            />
        </div>
    )
}