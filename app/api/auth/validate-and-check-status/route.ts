import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SessionManager } from "@/lib/session-manager";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json();

    if (!phoneNumber || !password) {
      return NextResponse.json(
        { error: "Missing credentials", isValid: false },
        { status: 400 }
      );
    }

    // Find and validate user
    const user = await db.user.findUnique({
      where: { phoneNumber },
      select: { id: true, hashedPassword: true, role: true, isActive: true }
    });

    if (!user || !user.hashedPassword) {
      return NextResponse.json(
        { error: "Invalid credentials", isValid: false },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials", isValid: false },
        { status: 401 }
      );
    }

    // Check if already logged in (skip for TEACHER/ADMIN)
    const isAlreadyLoggedIn =
      user.isActive &&
      user.role !== "TEACHER" &&
      user.role !== "ADMIN";

    return NextResponse.json({
      isValid: true,
      isAlreadyLoggedIn,
      role: user.role
    });
  } catch (error) {
    console.error("Error in validate-and-check-status:", error);
    return NextResponse.json(
      { error: "Internal server error", isValid: false },
      { status: 500 }
    );
  }
}

