-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "marks_course_id" INTEGER;

-- CreateTable
CREATE TABLE "MarksCourse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "MarksCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" SERIAL NOT NULL,
    "marks_course_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "practical_grade" INTEGER NOT NULL,
    "theoretical_grade" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarksCourse_name_key" ON "MarksCourse"("name");

-- CreateIndex
CREATE INDEX "Mark_marks_course_id_idx" ON "Mark"("marks_course_id");

-- CreateIndex
CREATE INDEX "Mark_student_id_idx" ON "Mark"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_marks_course_id_student_id_key" ON "Mark"("marks_course_id", "student_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_marks_course_id_fkey" FOREIGN KEY ("marks_course_id") REFERENCES "MarksCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_marks_course_id_fkey" FOREIGN KEY ("marks_course_id") REFERENCES "MarksCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;
