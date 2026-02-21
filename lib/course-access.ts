import { db } from "@/lib/db";

/**
 * Returns true if the user has current access to the course:
 * - Course is free (price 0), OR
 * - Has a Purchase with status ACTIVE, AND
 *   either the purchase is not from a subscription (subscriptionPurchaseId is null),
 *   or the linked SubscriptionPurchase has not expired (expiresAt > now).
 */
export async function hasCourseAccess(
  userId: string,
  courseId: string
): Promise<boolean> {
  const now = new Date();

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { price: true },
  });
  if (!course) return false;
  if (course.price === 0 || course.price === null) return true;

  const purchase = await db.purchase.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
    include: {
      subscriptionPurchase: {
        select: { expiresAt: true },
      },
    },
  });

  if (!purchase || purchase.status !== "ACTIVE") {
    return false;
  }

  if (!purchase.subscriptionPurchaseId) {
    return true;
  }

  if (!purchase.subscriptionPurchase) {
    return true;
  }

  return now < purchase.subscriptionPurchase.expiresAt;
}

/**
 * Returns a Set of course IDs the user currently has access to (for batch display).
 */
export async function getAccessibleCourseIds(userId: string): Promise<Set<string>> {
  const purchases = await db.purchase.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      subscriptionPurchase: { select: { expiresAt: true } },
    },
  });
  const now = new Date();
  const accessible = new Set<string>();
  for (const p of purchases) {
    if (!p.subscriptionPurchaseId) {
      accessible.add(p.courseId);
      continue;
    }
    if (!p.subscriptionPurchase) {
      accessible.add(p.courseId);
      continue;
    }
    if (now < p.subscriptionPurchase.expiresAt) {
      accessible.add(p.courseId);
    }
  }
  return accessible;
}

/**
 * Returns a Set of course IDs the user has access to: purchased (valid) + free courses.
 */
export async function getAccessibleCourseIdsIncludingFree(
  userId: string
): Promise<Set<string>> {
  const purchased = await getAccessibleCourseIds(userId);
  const freeCourses = await db.course.findMany({
    where: {
      isPublished: true,
      OR: [{ price: 0 }, { price: null }],
    },
    select: { id: true },
  });
  const set = new Set(purchased);
  for (const c of freeCourses) {
    set.add(c.id);
  }
  return set;
}
