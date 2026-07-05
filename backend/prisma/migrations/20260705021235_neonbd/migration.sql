-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "anotadoresA" JSONB,
ADD COLUMN     "anotadoresB" JSONB,
ADD COLUMN     "fechaFinalizacion" TEXT,
ADD COLUMN     "fechaInicio" TEXT,
ADD COLUMN     "sets" JSONB;
