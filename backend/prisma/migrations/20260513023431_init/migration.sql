-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "genero" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NivelEducacional" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NivelEducacional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nivelEducacional" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "paralelo" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nivelEducacional" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jugador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "paralelo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nivelEducacional" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "equipoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "equipoAId" TEXT,
    "equipoBId" TEXT,
    "grupo" TEXT,
    "fase" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'programado',
    "disciplina" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "nivelEducacional" TEXT NOT NULL,
    "marcadorA" INTEGER DEFAULT 0,
    "marcadorB" INTEGER DEFAULT 0,
    "fecha" TEXT,
    "hora" TEXT,
    "goleadoresA" JSONB,
    "goleadoresB" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Jugador" ADD CONSTRAINT "Jugador_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_equipoAId_fkey" FOREIGN KEY ("equipoAId") REFERENCES "Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_equipoBId_fkey" FOREIGN KEY ("equipoBId") REFERENCES "Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
