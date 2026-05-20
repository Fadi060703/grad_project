/*
  Warnings:

  - A unique constraint covering the columns `[order]` on the table `Year` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `group_id` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year_id` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `Year` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StudentCourseStatus" AS ENUM ('ENROLLED', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "LectureType" AS ENUM ('THEORETICAL', 'PRACTICAL');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "group_id" INTEGER NOT NULL,
ADD COLUMN     "major_id" INTEGER,
ADD COLUMN     "section_id" INTEGER,
ADD COLUMN     "year_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Year" ADD COLUMN     "order" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "student_courses" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "enrollment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StudentCourseStatus" NOT NULL DEFAULT 'ENROLLED',

    CONSTRAINT "student_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_id" INTEGER,
    "course_id" INTEGER NOT NULL,
    "lecture_type" "LectureType" NOT NULL DEFAULT 'THEORETICAL',
    "major_id" INTEGER,
    "section_id" INTEGER,
    "group_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_courses_student_id_course_id_key" ON "student_courses"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "lectures_course_id_idx" ON "lectures"("course_id");

-- CreateIndex
CREATE INDEX "lectures_date_idx" ON "lectures"("date");

-- CreateIndex
CREATE INDEX "lectures_major_id_idx" ON "lectures"("major_id");

-- CreateIndex
CREATE INDEX "lectures_section_id_idx" ON "lectures"("section_id");

-- CreateIndex
CREATE INDEX "lectures_group_id_idx" ON "lectures"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Year_order_key" ON "Year"("order");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "Year"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "university_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
