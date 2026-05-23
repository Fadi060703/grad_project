-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('REGULAR', 'IMPORTANT', 'EMERGENCY');

-- CreateTable
CREATE TABLE "faculity_info" (
    "id" SERIAL NOT NULL,
    "telegram_url" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "website_url" TEXT,
    "university_name" TEXT,
    "faculity_name" TEXT,
    "faculity_picture_url" TEXT,
    "support_email" TEXT,
    "lectures_schedule_url" TEXT,
    "theoritical_exam_schedule_url" TEXT,
    "practical_exam_schedule_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculity_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'REGULAR',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year_id" INTEGER,
    "section_id" INTEGER,
    "major_id" INTEGER,
    "group_id" INTEGER,
    "course_id" INTEGER,
    "student_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_year_id_idx" ON "announcements"("year_id");

-- CreateIndex
CREATE INDEX "announcements_section_id_idx" ON "announcements"("section_id");

-- CreateIndex
CREATE INDEX "announcements_major_id_idx" ON "announcements"("major_id");

-- CreateIndex
CREATE INDEX "announcements_group_id_idx" ON "announcements"("group_id");

-- CreateIndex
CREATE INDEX "announcements_course_id_idx" ON "announcements"("course_id");

-- CreateIndex
CREATE INDEX "announcements_student_id_idx" ON "announcements"("student_id");

-- CreateIndex
CREATE INDEX "announcements_type_idx" ON "announcements"("type");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "Year"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
