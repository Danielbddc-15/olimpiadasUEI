import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Genera todos los partidos todos contra todos para un grupo
 * @param {string} categoriaId - ID de la categoría
 * @param {string} grupoId - ID del grupo
 * @param {Array} equipos - Array de objetos equipo { id, nombre }
 * @returns {Promise<Array>} - Array de partidos creados
 */
export async function generarPartidosGrupo(categoriaId, grupoId, equipos) {
  const partidos = [];
  for (let i = 0; i < equipos.length; i++) {
    for (let j = i + 1; j < equipos.length; j++) {
      const partido = {
        equipoA: equipos[i],
        equipoB: equipos[j],
        golesA: 0,
        golesB: 0,
        jugado: false,
        fecha: null,
        categoriaId,
        grupoId,
      };
      // Guardar en Firestore
      const ref = await addDoc(
        collection(db, `categorias/${categoriaId}/grupos/${grupoId}/partidos`),
        partido
      );
      partidos.push({ id: ref.id, ...partido });
    }
  }
  return partidos;
}

/**
 * Dado un array de posiciones, genera los cruces de semifinales
 * @param {Array} clasificadosA - Array de equipos clasificados del grupo A (ordenados por posición)
 * @param {Array} clasificadosB - Array de equipos clasificados del grupo B (ordenados por posición)
 * @param {string} modo - "cruzado" o "mismo" (default: cruzado)
 * @returns {Array} - Array de objetos { equipo1, equipo2 }
 */
export function generarSemifinales(clasificadosA, clasificadosB, modo = "cruzado") {
  if (modo === "cruzado") {
    return [
      { equipo1: clasificadosA[0], equipo2: clasificadosB[1] },
      { equipo1: clasificadosB[0], equipo2: clasificadosA[1] },
    ];
  } else {
    return [
      { equipo1: clasificadosA[0], equipo2: clasificadosB[0] },
      { equipo1: clasificadosA[1], equipo2: clasificadosB[1] },
    ];
  }
}
