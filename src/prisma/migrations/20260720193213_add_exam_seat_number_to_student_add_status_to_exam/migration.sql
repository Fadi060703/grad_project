-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('NOT_READY', 'READY', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "exam_seat_number" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "status" "ExamStatus" NOT NULL DEFAULT 'NOT_READY';
