"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { getDashboardUrlByRole } from "@/lib/utils";

function DeviceConflictContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const phoneNumber = searchParams.get("phoneNumber") || "";
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleForceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First, call force-login to sign out all devices
      const response = await fetch("/api/auth/force-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password })
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "فشل تسجيل الخروج من الأجهزة الأخرى");
        return;
      }

      // Then, sign in on current device
      const result = await signIn("credentials", {
        phoneNumber,
        password,
        redirect: false
      });

      if (result?.error) {
        toast.error("رقم الهاتف أو كلمة المرور غير صحيحة");
        return;
      }

      toast.success("تم تسجيل الدخول بنجاح");

      // Get user data to determine role and redirect accordingly
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await sessionResponse.json();
      const userRole = sessionData?.user?.role || "USER";
      const dashboardUrl = getDashboardUrlByRole(userRole);

      // Force a full reload to ensure fresh session on the dashboard
      const target = `${dashboardUrl}?t=${Date.now()}`;
      if (typeof window !== "undefined") {
        window.location.replace(target);
      } else {
        router.replace(target);
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Dialog 
        open={true} 
        onOpenChange={() => {}}
      >
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-center">
              الحساب مسجل الدخول على جهاز آخر
            </DialogTitle>
            <DialogDescription className="text-center">
              هذا الحساب مسجل الدخول حالياً على جهاز آخر.
              لتسجيل الدخول على هذا الجهاز، يجب تسجيل الخروج من جميع الأجهزة الأخرى أولاً.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForceLogin} className="space-y-4 mt-4">
            <input
              type="tel"
              value={phoneNumber}
              readOnly
              className="hidden"
            />
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  required
                  disabled={isLoading}
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="جاري تسجيل الخروج والدخول..."
              className="w-full h-10 bg-brand hover:bg-brand/90 text-white"
            >
              تسجيل الخروج من جميع الأجهزة وتسجيل الدخول
            </LoadingButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DeviceConflictPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>}>
      <DeviceConflictContent />
    </Suspense>
  );
}

