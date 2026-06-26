/*
  Warnings:

  - Added the required column `end_time` to the `exam_settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `exam_settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exam_settings" ADD COLUMN     "end_time" TEXT NOT NULL,
ADD COLUMN     "start_time" TEXT NOT NULL;
