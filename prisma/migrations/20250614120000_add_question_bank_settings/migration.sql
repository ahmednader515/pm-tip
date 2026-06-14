-- Question bank display name (singleton)
CREATE TABLE IF NOT EXISTS "QuestionBankSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "displayName" TEXT NOT NULL DEFAULT 'بنك الأسئلة',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBankSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "QuestionBankSettings" ("id", "displayName", "updatedAt")
VALUES ('default', 'بنك الأسئلة', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
