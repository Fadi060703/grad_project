-- Delete existing marks per product decision before introducing academic-keyed marks.
TRUNCATE TABLE "Mark" CASCADE;

-- CreateEnum
CREATE TYPE "CourseMarksPublishType" AS ENUM ('PRACTICAL', 'FULL');

-- DropIndex
DROP INDEX IF EXISTS "Mark_course_id_student_id_key";

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN "current_academic_key" TEXT;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "is_practical_marks_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_marks_published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Mark" ADD COLUMN "academic_key" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "course_marks_publications" (
  "id" SERIAL NOT NULL,
  "course_id" INTEGER NOT NULL,
  "academic_key" TEXT NOT NULL,
  "publish_type" "CourseMarksPublishType" NOT NULL,
  "published_by" INTEGER NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),

  CONSTRAINT "course_marks_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mark_course_id_student_id_academic_key_key" ON "Mark"("course_id", "student_id", "academic_key");

-- CreateIndex
CREATE INDEX "Mark_academic_key_idx" ON "Mark"("academic_key");

-- CreateIndex
CREATE UNIQUE INDEX "course_marks_publications_course_id_academic_key_key" ON "course_marks_publications"("course_id", "academic_key");

-- CreateIndex
CREATE INDEX "course_marks_publications_course_id_idx" ON "course_marks_publications"("course_id");

-- CreateIndex
CREATE INDEX "course_marks_publications_academic_key_idx" ON "course_marks_publications"("academic_key");

-- AddForeignKey
ALTER TABLE "course_marks_publications" ADD CONSTRAINT "course_marks_publications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
