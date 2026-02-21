"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "next-auth/react";
import { ScrollProgress } from "@/components/scroll-progress";
import { LogOut } from "lucide-react";

export const Navbar = () => {
  const { data: session, status } = useSession();

  // Check if session is valid (not expired or empty)
  const isValidSession = session?.user?.id && session.user.id !== "";

  const handleLogout = async () => {
    try {
      // Call logout API to end session
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0 w-14 h-14 md:w-16 md:h-16 relative">
            <Image
              src="/logo.png"
              alt="Logo"
              fill
              className="object-contain"
              unoptimized
              sizes="64px"
            />
          </Link>

          {/* Right side items */}
          <div className="flex items-center gap-4">
            {!isValidSession || status === "unauthenticated" ? (
              <>
                <Button className="bg-brand hover:bg-brand/90 text-white" asChild>
                  <Link href="/sign-up">انشاء الحساب</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="border-brand text-brand hover:bg-brand/10"
                >
                  <Link href="/sign-in">تسجيل الدخول</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/dashboard">لوحة التحكم</Link>
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200 ease-in-out"
                >
                  <LogOut className="h-4 w-4 rtl:ml-2 ltr:mr-2"/>
                  تسجيل الخروج
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <ScrollProgress />
    </div>
  );
}; 