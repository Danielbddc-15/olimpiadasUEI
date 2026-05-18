/*
  Warnings:

  - The `numero` column on the `Jugador` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Jugador" DROP COLUMN "numero",
ADD COLUMN     "numero" INTEGER;
