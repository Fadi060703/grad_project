-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "profile_picture" TEXT;

-- AlterTable
ALTER TABLE "university_locations" ADD COLUMN     "photo_array" TEXT[] DEFAULT ARRAY[]::TEXT[];
