import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SessionManager } from "@/lib/session-manager";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json();

    if (!phoneNumber || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    // Validate credentials
    const user = await db.user.findUnique({
      where: { phoneNumber },
      select: { id: true, hashedPassword: true }
    });

    if (!user || !user.hashedPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Sign out all devices
    await SessionManager.endSession(user.id);

    // Verify fields are cleared
    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, sessionId: true }
    });

    if (updatedUser?.isActive || updatedUser?.sessionId) {
      // Force clear if still active
      await db.user.update({
        where: { id: user.id },
        data: { isActive: false, sessionId: null }
      });
    }

    return NextResponse.json({
      success: true,
      message: "All devices signed out successfully"
    });
  } catch (error) {
    console.error("Error in force-login:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

