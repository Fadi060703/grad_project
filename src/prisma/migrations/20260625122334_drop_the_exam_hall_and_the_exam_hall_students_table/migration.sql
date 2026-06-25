/*
  Warnings:

  - You are about to drop the `exam_hall_students` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `exam_halls` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "exam_hall_students" DROP CONSTRAINT "exam_hall_students_hall_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_hall_students" DROP CONSTRAINT "exam_hall_students_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_halls" DROP CONSTRAINT "exam_halls_exam_settings_id_fkey";

-- DropTable
DROP TABLE "exam_hall_students";

-- DropTable
DROP TABLE "exam_halls";

-- DropEnum
DROP TYPE "AttendanceStatus";

-- CreateTable
CREATE TABLE "_ExamSettingsStudents" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ExamSettingsStudents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ExamSettingsStudents_B_index" ON "_ExamSettingsStudents"("B");

-- AddForeignKey
ALTER TABLE "_ExamSettingsStudents" ADD CONSTRAINT "_ExamSettingsStudents_A_fkey" FOREIGN KEY ("A") REFERENCES "exam_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExamSettingsStudents" ADD CONSTRAINT "_ExamSettingsStudents_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;
