/*
  Warnings:

  - You are about to drop the column `majorId` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `sectionId` on the `courses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,major_id,section_id]` on the table `courses` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_majorId_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_sectionId_fkey";

-- DropIndex
DROP INDEX "courses_name_majorId_sectionId_key";

-- AlterTable
ALTER TABLE "Year" ADD COLUMN     "has_majors" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "majorId",
DROP COLUMN "sectionId",
ADD COLUMN     "major_id" INTEGER,
ADD COLUMN     "section_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_major_id_section_id_key" ON "courses"("name", "major_id", "section_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
