import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  or,
} from "firebase/firestore";
import { db } from "../firebase/config";

export const generarPartidosFutbol = async () => {
  try {
    const equiposSnapshot = await getDocs(collection(db, "equipos"));
    const equipos = equiposSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const grupos = {
      "Grupo 1: Octavos": equipos.filter((e) => e.curso === "Octavo"),
      "Grupo 2: Noveno y Décimo": equipos.filter((e) =>
        ["Noveno", "Décimo"].includes(e.curso)
      ),
      "Grupo 3: Paralelo A": equipos.filter(
        (e) =>
          ["Primero", "Segundo", "Tercero"].includes(e.curso) &&
          e.paralelo === "A"
      ),
      "Grupo 4: Paralelo B": equipos.filter(
        (e) =>
          ["Primero", "Segundo", "Tercero"].includes(e.curso) &&
          e.paralelo === "B"
      ),
    };

    const generatedPairs = new Set(); // Para evitar duplicados dentro del mismo ciclo

    for (const [grupoNombre, grupoEquipos] of Object.entries(grupos)) {
      for (let i = 0; i < grupoEquipos.length; i++) {
        for (let j = i + 1; j < grupoEquipos.length; j++) {
          const equipoA = grupoEquipos[i];
          const equipoB = grupoEquipos[j];

          // Identificador único sin importar el orden
          const pairKey =
            equipoA.id < equipoB.id
              ? `${equipoA.id}-${equipoB.id}`
              : `${equipoB.id}-${equipoA.id}`;

          if (generatedPairs.has(pairKey)) continue;
          generatedPairs.add(pairKey);

          // Verificar en Firebase si existe el partido en cualquier orden
          const q = query(
            collection(db, "matches"),
            where("disciplina", "==", "futbol"),
            where("equipoA.id", "in", [equipoA.id, equipoB.id]),
            where("equipoB.id", "in", [equipoA.id, equipoB.id])
          );
          const snapshot = await getDocs(q);

          const partidoYaExiste = snapshot.docs.some((doc) => {
            const data = doc.data();
            return (
              (data.equipoA.id === equipoA.id &&
                data.equipoB.id === equipoB.id) ||
              (data.equipoA.id === equipoB.id &&
                data.equipoB.id === equipoA.id)
            );
          });

          if (!partidoYaExiste) {
            await addDoc(collection(db, "matches"), {
              equipoA,
              equipoB,
              fecha: "",
              hora: "",
              disciplina: "futbol",
            });
          }
        }
      }
    }

    console.log("✅ Partidos generados sin duplicados.");
  } catch (error) {
    console.error("❌ Error generando partidos:", error);
  }
};
