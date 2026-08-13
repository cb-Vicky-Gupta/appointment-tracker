/*
  Warnings:

  - You are about to drop the column `pgYear` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "pgYear",
ADD COLUMN     "studentType" TEXT,
ADD COLUMN     "year" TEXT;
