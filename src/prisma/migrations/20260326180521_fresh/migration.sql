/*
  Warnings:

  - You are about to drop the column `dateOfBirth` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `fatherName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `motherName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `placeOfBirth` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Auth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Fee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupStock` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DOCTOR', 'TEACHER', 'STUDENT');

-- DropForeignKey
ALTER TABLE "Fee" DROP CONSTRAINT "Fee_userId_fkey";

-- DropForeignKey
ALTER TABLE "GroupStock" DROP CONSTRAINT "GroupStock_groupId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_groupId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dateOfBirth",
DROP COLUMN "fatherName",
DROP COLUMN "fullName",
DROP COLUMN "groupId",
DROP COLUMN "motherName",
DROP COLUMN "placeOfBirth",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL,
ADD COLUMN     "status" BOOLEAN NOT NULL,
ADD COLUMN     "userName" TEXT NOT NULL;

-- DropTable
DROP TABLE "Auth";

-- DropTable
DROP TABLE "Fee";

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "GroupStock";

-- DropEnum
DROP TYPE "AccType";
