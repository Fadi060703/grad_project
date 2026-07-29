-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND');

-- AlterTable
ALTER TABLE "courses"
ADD COLUMN "code" TEXT,
ADD COLUMN "image" TEXT,
ADD COLUMN "semester" "Semester" DEFAULT 'FIRST';

-- Backfill existing courses
UPDATE "courses"
SET "semester" = 'FIRST'
WHERE "semester" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");
