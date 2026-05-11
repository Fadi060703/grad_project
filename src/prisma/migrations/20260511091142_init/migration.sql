/*
  Warnings:

  - The primary key for the `Student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `mothersName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `rollNum` on the `Student` table. All the data in the column will be lost.
  - Added the required column `mother_name` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Student" DROP CONSTRAINT "Student_pkey",
DROP COLUMN "mothersName",
DROP COLUMN "rollNum",
ADD COLUMN     "mother_name" TEXT NOT NULL,
ADD COLUMN     "student_id" SERIAL NOT NULL,
ADD CONSTRAINT "Student_pkey" PRIMARY KEY ("student_id");
