/*
  Warnings:

  - You are about to drop the column `major_id` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `section_id` on the `courses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `courses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `year_id` to the `courses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_major_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_section_id_fkey";

-- DropIndex
DROP INDEX "courses_name_major_id_section_id_key";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "major_id",
DROP COLUMN "section_id",
ADD COLUMN     "year_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "section_courses" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,

    CONSTRAINT "section_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major_courses" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "major_id" INTEGER NOT NULL,

    CONSTRAINT "major_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_courses_course_id_idx" ON "section_courses"("course_id");

-- CreateIndex
CREATE INDEX "section_courses_section_id_idx" ON "section_courses"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_courses_course_id_section_id_key" ON "section_courses"("course_id", "section_id");

-- CreateIndex
CREATE INDEX "major_courses_course_id_idx" ON "major_courses"("course_id");

-- CreateIndex
CREATE INDEX "major_courses_major_id_idx" ON "major_courses"("major_id");

-- CreateIndex
CREATE UNIQUE INDEX "major_courses_course_id_major_id_key" ON "major_courses"("course_id", "major_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "Year"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_courses" ADD CONSTRAINT "section_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_courses" ADD CONSTRAINT "section_courses_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_courses" ADD CONSTRAINT "major_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_courses" ADD CONSTRAINT "major_courses_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
