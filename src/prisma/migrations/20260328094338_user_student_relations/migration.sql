/*
  Warnings:

  - Added the required column `mothersName` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneNumber` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "mothersName" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Year" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Year_pkey" PRIMARY KEY ("id")
);
