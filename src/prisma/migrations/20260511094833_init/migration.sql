/*
  Warnings:

  - You are about to drop the column `yearId` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `majorId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `sectionId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `yearId` on the `majors` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,year_id]` on the table `Section` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,section_id,major_id]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,year_id]` on the table `majors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `year_id` to the `Section` table without a default value. This is not possible if the table is not empty.
  - Added the required column `section_id` to the `groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year_id` to the `majors` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_yearId_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_majorId_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "majors" DROP CONSTRAINT "majors_yearId_fkey";

-- DropIndex
DROP INDEX "Section_name_yearId_key";

-- DropIndex
DROP INDEX "groups_name_sectionId_key";

-- DropIndex
DROP INDEX "majors_name_yearId_key";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "yearId",
ADD COLUMN     "year_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "majorId",
DROP COLUMN "sectionId",
ADD COLUMN     "major_id" INTEGER,
ADD COLUMN     "section_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "majors" DROP COLUMN "yearId",
ADD COLUMN     "year_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_year_id_key" ON "Section"("name", "year_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_section_id_major_id_key" ON "groups"("name", "section_id", "major_id");

-- CreateIndex
CREATE UNIQUE INDEX "majors_name_year_id_key" ON "majors"("name", "year_id");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "Year"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "Year"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
