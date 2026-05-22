-- QuizDraft (resume index)
CREATE TABLE IF NOT EXISTS "QuizDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuizDraft_userId_quizId_key" ON "QuizDraft"("userId", "quizId");
CREATE INDEX IF NOT EXISTS "QuizDraft_userId_idx" ON "QuizDraft"("userId");
CREATE INDEX IF NOT EXISTS "QuizDraft_quizId_idx" ON "QuizDraft"("quizId");

DO $$ BEGIN
    ALTER TABLE "QuizDraft" ADD CONSTRAINT "QuizDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "QuizDraft" ADD CONSTRAINT "QuizDraft_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Store
CREATE TABLE IF NOT EXISTS "StoreProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreProduct_userId_idx" ON "StoreProduct"("userId");
CREATE INDEX IF NOT EXISTS "StoreProduct_isPublished_idx" ON "StoreProduct"("isPublished");

DO $$ BEGIN
    ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProductPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pricePaid" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPurchase_userId_productId_key" ON "ProductPurchase"("userId", "productId");
CREATE INDEX IF NOT EXISTS "ProductPurchase_userId_idx" ON "ProductPurchase"("userId");
CREATE INDEX IF NOT EXISTS "ProductPurchase_productId_idx" ON "ProductPurchase"("productId");

DO $$ BEGIN
    ALTER TABLE "ProductPurchase" ADD CONSTRAINT "ProductPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProductPurchase" ADD CONSTRAINT "ProductPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Homepage CMS singleton
CREATE TABLE IF NOT EXISTS "HomepageSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "teacherImageUrl" TEXT,
    "headerLogoUrl" TEXT,
    "footerPhone" TEXT NOT NULL DEFAULT '01009560680',
    "testimonials" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSettings_pkey" PRIMARY KEY ("id")
);

-- If QuizDraft already existed without currentQuestionIndex
ALTER TABLE "QuizDraft" ADD COLUMN IF NOT EXISTS "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0;
