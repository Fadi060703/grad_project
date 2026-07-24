TRUNCATE TABLE "Mark" CASCADE;
/*
  Warnings:

  - You are about to drop the column `marks_course_id` on the `Mark` table. All the data in the column will be lost.
  - You are about to drop the column `marks_course_id` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the `MarksCourse` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[course_id,student_id]` on the table `Mark` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `course_id` to the `Mark` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Mark" DROP CONSTRAINT "Mark_marks_course_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_marks_course_id_fkey";

-- DropIndex
DROP INDEX "Mark_marks_course_id_idx";

-- DropIndex
DROP INDEX "Mark_marks_course_id_student_id_key";

-- AlterTable
ALTER TABLE "Mark" DROP COLUMN "marks_course_id",
ADD COLUMN     "course_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "marks_course_id";

-- DropTable
DROP TABLE "MarksCourse";

-- CreateIndex
CREATE INDEX "Mark_course_id_idx" ON "Mark"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_course_id_student_id_key" ON "Mark"("course_id", "student_id");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
