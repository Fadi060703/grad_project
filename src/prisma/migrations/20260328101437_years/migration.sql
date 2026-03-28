/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Year` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Year` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Year" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Year_name_key" ON "Year"("name");
