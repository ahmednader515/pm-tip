import { randomBytes } from "crypto";
import { db } from "@/lib/db";

export class SessionManager {
  // Generate unique 32-byte hex session ID
  private static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Check if user is already logged in
  static async isUserActive(userId: string): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true, sessionId: true, role: true }
    });
    return user?.isActive || false;
  }

  // Create a new session (sets isActive = true, generates sessionId)
  static async createSession(userId: string): Promise<string> {
    const sessionId = this.generateSessionId();
    await db.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        sessionId: sessionId,
        lastLoginAt: new Date()
      }
    });
    return sessionId;
  }

  // End session (sets isActive = false, clears sessionId)
  static async endSession(userId: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        sessionId: null
      }
    });
  }

  // Validate session - supports multi-device for TEACHER/ADMIN
  static async validateSession(
    sessionId: string,
    userId?: string
  ): Promise<{ user: any; isValid: boolean }> {
    if (!sessionId) {
      return { user: null, isValid: false };
    }

    let user = null;

    // For TEACHER/ADMIN: validate by userId + isActive (multi-device)
    if (userId) {
      user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          image: true,
          isActive: true,
          sessionId: true,
          lastLoginAt: true
        }
      });

      if (user && (user.role === "TEACHER" || user.role === "ADMIN")) {
        return {
          user: user.isActive ? user : null,
          isValid: user.isActive
        };
      }
    }

    // For regular users: validate by exact sessionId match (single-device)
    if (!user) {
      user = await db.user.findUnique({
        where: { sessionId },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          image: true,
          isActive: true,
          sessionId: true,
          lastLoginAt: true
        }
      });
    }

    if (!user || !user.isActive) {
      return { user: null, isValid: false };
    }

    // For regular users, require exact sessionId match
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      if (user.sessionId !== sessionId) {
        return { user: null, isValid: false };
      }
    }

    return { user, isValid: true };
  }
}

