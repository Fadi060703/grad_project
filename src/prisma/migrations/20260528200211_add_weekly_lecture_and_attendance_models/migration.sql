-- CreateEnum
CREATE TYPE "WeeklyLectureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExamCategory" AS ENUM ('THEORETICAL', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ABSENT', 'PRESENT');

-- CreateTable
CREATE TABLE "weekly_lectures" (
    "id" SERIAL NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "lecture_date" DATE NOT NULL,
    "status" "WeeklyLectureStatus" NOT NULL DEFAULT 'DRAFT',
    "qr_string" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_attendances" (
    "id" SERIAL NOT NULL,
    "weekly_lecture_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "has_attended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "type" "ExamCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_settings" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_halls" (
    "id" SERIAL NOT NULL,
    "exam_settings_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_hall_students" (
    "id" SERIAL NOT NULL,
    "hall_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "seat_number" TEXT NOT NULL,
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_hall_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_lectures_lecture_date_idx" ON "weekly_lectures"("lecture_date");

-- CreateIndex
CREATE INDEX "weekly_lectures_status_idx" ON "weekly_lectures"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_lectures_lecture_id_lecture_date_key" ON "weekly_lectures"("lecture_id", "lecture_date");

-- CreateIndex
CREATE INDEX "lecture_attendances_weekly_lecture_id_idx" ON "lecture_attendances"("weekly_lecture_id");

-- CreateIndex
CREATE INDEX "lecture_attendances_student_id_idx" ON "lecture_attendances"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_attendances_weekly_lecture_id_student_id_key" ON "lecture_attendances"("weekly_lecture_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exams_course_id_type_key" ON "exams"("course_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "exam_hall_students_hall_id_seat_number_key" ON "exam_hall_students"("hall_id", "seat_number");

-- CreateIndex
CREATE UNIQUE INDEX "exam_hall_students_hall_id_student_id_key" ON "exam_hall_students"("hall_id", "student_id");

-- AddForeignKey
ALTER TABLE "weekly_lectures" ADD CONSTRAINT "weekly_lectures_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_attendances" ADD CONSTRAINT "lecture_attendances_weekly_lecture_id_fkey" FOREIGN KEY ("weekly_lecture_id") REFERENCES "weekly_lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_attendances" ADD CONSTRAINT "lecture_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_settings" ADD CONSTRAINT "exam_settings_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_settings" ADD CONSTRAINT "exam_settings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "university_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_halls" ADD CONSTRAINT "exam_halls_exam_settings_id_fkey" FOREIGN KEY ("exam_settings_id") REFERENCES "exam_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_hall_students" ADD CONSTRAINT "exam_hall_students_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "exam_halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_hall_students" ADD CONSTRAINT "exam_hall_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;
