-- CreateEnum
CREATE TYPE "LectureType" AS ENUM ('THEORETICAL', 'PRACTICAL');

-- CreateTable
CREATE TABLE "lectures" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_id" INTEGER,
    "course_id" INTEGER NOT NULL,
    "lecture_type" "LectureType" NOT NULL DEFAULT 'THEORETICAL',
    "major_id" INTEGER,
    "section_id" INTEGER,
    "group_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lectures_course_id_idx" ON "lectures"("course_id");

-- CreateIndex
CREATE INDEX "lectures_date_idx" ON "lectures"("date");

-- CreateIndex
CREATE INDEX "lectures_major_id_idx" ON "lectures"("major_id");

-- CreateIndex
CREATE INDEX "lectures_section_id_idx" ON "lectures"("section_id");

-- CreateIndex
CREATE INDEX "lectures_group_id_idx" ON "lectures"("group_id");

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "university_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
