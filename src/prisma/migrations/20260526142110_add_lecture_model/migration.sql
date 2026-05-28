/*
  Warnings:

  - You are about to drop the column `date` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `lectures` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `lectures` table. All the data in the column will be lost.
  - Added the required column `day` to the `lectures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instructor_id` to the `lectures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_box_order` to the `lectures` table without a default value. This is not possible if the table is not empty.
  - Made the column `location_id` on table `lectures` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY');

-- DropForeignKey
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_location_id_fkey";

-- DropForeignKey
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_major_id_fkey";

-- DropForeignKey
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_section_id_fkey";

-- DropIndex
DROP INDEX "lectures_date_idx";

-- DropIndex
DROP INDEX "lectures_group_id_idx";

-- AlterTable
ALTER TABLE "lectures" DROP COLUMN "date",
DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "day" "WeekDay" NOT NULL,
ADD COLUMN     "instructor_id" INTEGER NOT NULL,
ADD COLUMN     "time_box_order" INTEGER NOT NULL,
ALTER COLUMN "location_id" SET NOT NULL,
ALTER COLUMN "lecture_type" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "lectures_day_time_box_order_idx" ON "lectures"("day", "time_box_order");

-- CreateIndex
CREATE INDEX "lectures_instructor_id_idx" ON "lectures"("instructor_id");

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "university_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
