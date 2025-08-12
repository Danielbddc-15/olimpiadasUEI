import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useParams } from "react-router-dom";
import "../styles/AdminMatches.css";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";

export default function AdminMatches() {
  const { discipline } = useParams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMatch, setNewMatch] = useState({
    equipoA: "",
    equipoB: "",
    fecha: "",
    hora: "",
  });
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editedMatch, setEditedMatch] = useState({ fecha: "", hora: "" });
  const [scoreEdit, setScoreEdit] = useState({});
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nivelesEducacionales, setNivelesEducacionales] = useState([]);
  
  // Estados para filtros con persistencia
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_genero') || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_nivel') || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_categoria') || "";
  });

  // Función para verificar si una fase está completa
  const verificarFaseCompleta = (fase, partidosFase) => {
    if (!partidosFase || partidosFase.length === 0) return false;
    
    // Si es fase de grupos 1, verificar que todos los partidos estén finalizados
    if (fase === "grupos1") {
      const partidosPendientes = matches.filter(m => (m.fase || "grupos1") === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    // Para fases 2 y 3, verificar que todos los partidos de esa fase estén finalizados
    if (fase === "grupos2" || fase === "grupos3") {
      const partidosPendientes = matches.filter(m => m.fase === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    // Para semifinales y finales, verificar que todos los partidos estén finalizados
    if (fase === "semifinales" || fase === "finales") {
      const partidosPendientes = matches.filter(m => m.fase === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    return false;
  };

  
  // Función auxiliar para obtener el nivel educacional correcto de un equipo
  const obtenerNivelEducacionalDeEquipo = async (equipo) => {
    try {
      // Si el equipo ya tiene nivel educacional válido, usarlo
      if (equipo.nivelEducacional && equipo.nivelEducacional !== "Sin definir") {
        return equipo.nivelEducacional;
      }
      
      // Buscar jugadores de este equipo para obtener el nivel educacional
      const jugadoresSnapshot = await getDocs(
        query(
          collection(db, "jugadores"),
          where("disciplina", "==", discipline),
          where("curso", "==", equipo.curso),
          where("paralelo", "==", equipo.paralelo),
          where("categoria", "==", equipo.categoria),
          where("genero", "==", equipo.genero)
        )
      );
      
      if (!jugadoresSnapshot.empty) {
        const primerJugador = jugadoresSnapshot.docs[0].data();
        return primerJugador.nivelEducacional || "Sin definir";
      }
      
      return "Sin definir";
    } catch (error) {
      console.error("Error al obtener nivel educacional del equipo:", error);
      return "Sin definir";
    }
  };

  // Función auxiliar optimizada para obtener nivel educacional usando cache
  const obtenerNivelEducacionalConCache = async (equipo, cacheJugadores = null) => {
    try {
      // Si el equipo ya tiene nivel educacional válido, usarlo
      if (equipo.nivelEducacional && equipo.nivelEducacional !== "Sin definir") {
        return equipo.nivelEducacional;
      }
      
      // Si tenemos cache de jugadores, usarlo
      if (cacheJugadores) {
        const jugadoresDelEquipo = cacheJugadores.filter(jugador => 
          jugador.curso === equipo.curso &&
          jugador.paralelo === equipo.paralelo &&
          jugador.categoria === equipo.categoria &&
          jugador.genero === equipo.genero
        );
        
        if (jugadoresDelEquipo.length > 0) {
          return jugadoresDelEquipo[0].nivelEducacional || "Sin definir";
        }
      }
      
      // Fallback a la función original
      return await obtenerNivelEducacionalDeEquipo(equipo);
      
    } catch (error) {
      console.error("Error al obtener nivel educacional del equipo:", error);
      return "Sin definir";
    }
  };

  // Función para generar partidos "todos contra todos" para grupos
  const generarPartidosGrupos = async () => {
    if (!filtroGenero || !filtroCategoria) {
      showToast("Primero selecciona género y categoría para generar partidos", "warning");
      return;
    }

    try {
      // Obtener todos los jugadores de esta disciplina para usar como cache
      console.log("📊 Obteniendo jugadores para cache de niveles educacionales...");
      const jugadoresSnapshot = await getDocs(
        query(collection(db, "jugadores"), where("disciplina", "==", discipline))
      );
      const cacheJugadores = jugadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`✅ Cache de ${cacheJugadores.length} jugadores creado`);
      
      // Obtener equipos filtrados por género y categoría
      const equiposFiltrados = equipos.filter(eq => 
        eq.genero === filtroGenero && eq.categoria === filtroCategoria
      );

      if (equiposFiltrados.length < 2) {
        showToast("Se necesitan al menos 2 equipos para generar partidos", "warning");
        return;
      }

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Sin grupo";
        if (!equiposPorGrupo[grupo]) {
          equiposPorGrupo[grupo] = [];
        }
        equiposPorGrupo[grupo].push(equipo);
      });

      let partidosCreados = 0;

      // Generar partidos según el número de equipos en cada grupo
      for (const [nombreGrupo, equiposGrupo] of Object.entries(equiposPorGrupo)) {
        if (equiposGrupo.length < 2) continue;

        // Verificar si ya existen partidos para este grupo, género y categoría
        const partidosExistentes = matches.filter(m => 
          m.grupo === nombreGrupo && 
          m.equipoA?.genero === filtroGenero && 
          m.equipoA?.categoria === filtroCategoria &&
          (m.fase === "grupos" || m.fase === "ida" || m.fase === "vuelta")
        );

        if (partidosExistentes.length > 0) {
          console.log(`Ya existen ${partidosExistentes.length} partidos para el grupo "${nombreGrupo}". Omitiendo para evitar duplicados.`);
          continue;
        }

        const numEquipos = equiposGrupo.length;
        console.log(`🏟️ Procesando grupo "${nombreGrupo}" con ${numEquipos} equipos`);

        if (numEquipos === 2) {
          // CASO ESPECIAL: 2 equipos - Sistema de ida y vuelta
          console.log("⚽ Sistema de ida y vuelta para 2 equipos");
          
          const [equipoA, equipoB] = equiposGrupo;
          const nivelEducacionalA = await obtenerNivelEducacionalConCache(equipoA, cacheJugadores);
          const nivelEducacionalB = await obtenerNivelEducacionalConCache(equipoB, cacheJugadores);
          
          // Partido de IDA
          await addDoc(collection(db, "matches"), {
            equipoA: {
              curso: equipoA.curso,
              paralelo: equipoA.paralelo,
              genero: equipoA.genero,
              categoria: equipoA.categoria,
              nivelEducacional: nivelEducacionalA
            },
            equipoB: {
              curso: equipoB.curso,
              paralelo: equipoB.paralelo,
              genero: equipoB.genero,
              categoria: equipoB.categoria,
              nivelEducacional: nivelEducacionalB
            },
            grupo: nombreGrupo,
            fase: "ida",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0,
            marcadorB: 0,
            fecha: "",
            hora: "",
            goleadoresA: [],
            goleadoresB: [],
            observaciones: "Partido de ida - Sistema 2 equipos"
          });

          // Partido de VUELTA
          await addDoc(collection(db, "matches"), {
            equipoA: {
              curso: equipoB.curso,
              paralelo: equipoB.paralelo,
              genero: equipoB.genero,
              categoria: equipoB.categoria,
              nivelEducacional: nivelEducacionalB
            },
            equipoB: {
              curso: equipoA.curso,
              paralelo: equipoA.paralelo,
              genero: equipoA.genero,
              categoria: equipoA.categoria,
              nivelEducacional: nivelEducacionalA
            },
            grupo: nombreGrupo,
            fase: "vuelta",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0,
            marcadorB: 0,
            fecha: "",
            hora: "",
            goleadoresA: [],
            goleadoresB: [],
            observaciones: "Partido de vuelta - Sistema 2 equipos"
          });

          console.log(`✅ Creados partidos de ida y vuelta: ${equipoA.curso} ${equipoA.paralelo} vs ${equipoB.curso} ${equipoB.paralelo}`);
          partidosCreados += 2;

        } else if (numEquipos === 3) {
          // CASO ESPECIAL: 3 equipos - Todos contra todos (sin tercer puesto)
          console.log("🏆 Sistema todos contra todos para 3 equipos (final entre los 2 primeros)");
          
          // Generar partidos todos contra todos
          for (let i = 0; i < equiposGrupo.length; i++) {
            for (let j = i + 1; j < equiposGrupo.length; j++) {
              const equipoA = equiposGrupo[i];
              const equipoB = equiposGrupo[j];

              const nivelEducacionalA = await obtenerNivelEducacionalConCache(equipoA, cacheJugadores);
              const nivelEducacionalB = await obtenerNivelEducacionalConCache(equipoB, cacheJugadores);
              
              console.log(`🏷️ Creando partido: ${equipoA.curso} ${equipoA.paralelo} (${nivelEducacionalA}) vs ${equipoB.curso} ${equipoB.paralelo} (${nivelEducacionalB})`);
              
              await addDoc(collection(db, "matches"), {
                equipoA: {
                  curso: equipoA.curso,
                  paralelo: equipoA.paralelo,
                  genero: equipoA.genero,
                  categoria: equipoA.categoria,
                  nivelEducacional: nivelEducacionalA
                },
                equipoB: {
                  curso: equipoB.curso,
                  paralelo: equipoB.paralelo,
                  genero: equipoB.genero,
                  categoria: equipoB.categoria,
                  nivelEducacional: nivelEducacionalB
                },
                grupo: nombreGrupo,
                fase: "grupos",
                estado: "programado",
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                fecha: "",
                hora: "",
                goleadoresA: [],
                goleadoresB: [],
                observaciones: "Grupo de 3 equipos - Final entre los 2 primeros"
              });
              partidosCreados++;
            }
          }

        } else {
          // CASO NORMAL: 4+ equipos - Sistema tradicional de grupos
          console.log("⚽ Sistema tradicional de grupos para 4+ equipos");
          
          // Generar todos los enfrentamientos posibles (todos contra todos)
          for (let i = 0; i < equiposGrupo.length; i++) {
            for (let j = i + 1; j < equiposGrupo.length; j++) {
              const equipoA = equiposGrupo[i];
              const equipoB = equiposGrupo[j];

              // Verificar si ya existe este enfrentamiento
              const enfrentamientoExiste = matches.some(m => 
                m.grupo === nombreGrupo &&
                ((m.equipoA?.curso === equipoA.curso && m.equipoA?.paralelo === equipoA.paralelo &&
                  m.equipoB?.curso === equipoB.curso && m.equipoB?.paralelo === equipoB.paralelo) ||
                 (m.equipoA?.curso === equipoB.curso && m.equipoA?.paralelo === equipoB.paralelo &&
                  m.equipoB?.curso === equipoA.curso && m.equipoB?.paralelo === equipoA.paralelo))
              );

              if (!enfrentamientoExiste) {
                // Obtener niveles educacionales correctos usando cache
                const nivelEducacionalA = await obtenerNivelEducacionalConCache(equipoA, cacheJugadores);
                const nivelEducacionalB = await obtenerNivelEducacionalConCache(equipoB, cacheJugadores);
                
                console.log(`🏷️ Creando partido: ${equipoA.curso} ${equipoA.paralelo} (${nivelEducacionalA}) vs ${equipoB.curso} ${equipoB.paralelo} (${nivelEducacionalB})`);
                
                await addDoc(collection(db, "matches"), {
                  equipoA: {
                    curso: equipoA.curso,
                    paralelo: equipoA.paralelo,
                    genero: equipoA.genero,
                    categoria: equipoA.categoria,
                    nivelEducacional: nivelEducacionalA
                  },
                  equipoB: {
                    curso: equipoB.curso,
                    paralelo: equipoB.paralelo,
                    genero: equipoB.genero,
                    categoria: equipoB.categoria,
                    nivelEducacional: nivelEducacionalB
                  },
                  grupo: nombreGrupo,
                  fase: "grupos",
                  estado: "programado",
                  disciplina: discipline,
                  marcadorA: 0,
                  marcadorB: 0,
                  fecha: "",
                  hora: "",
                  goleadoresA: [],
                  goleadoresB: []
                });
                partidosCreados++;
              }
            }
          }
        }
      }

      if (partidosCreados > 0) {
        showToast(`Se crearon ${partidosCreados} partidos para la fase de grupos`, "success");
      } else {
        showToast("No se crearon partidos nuevos. Puede que ya existan todos los enfrentamientos.", "info");
      }

    } catch (error) {
      console.error("Error al generar partidos:", error);
      showToast("Error al generar partidos", "error");
    }
  };

  // Función helper para generar semifinales con formato específico
  const generarSemifinalesConFormato = async (gruposConEquipos, clasificaciones, cruzado) => {
    try {
      const [grupo1, grupo2] = gruposConEquipos;
      const primeroGrupo1 = clasificaciones[grupo1][0];
      const segundoGrupo1 = clasificaciones[grupo1][1];
      const primeroGrupo2 = clasificaciones[grupo2][0];
      const segundoGrupo2 = clasificaciones[grupo2][1];

      if (!primeroGrupo1 || !segundoGrupo1 || !primeroGrupo2 || !segundoGrupo2) {
        showToast("No hay suficientes equipos clasificados en las posiciones necesarias", "warning");
        return;
      }

      let partidosCreados = 0;

      // Generar semifinales según el formato
      if (cruzado) {
        // Cruzado: 1°A vs 2°B y 1°B vs 2°A
        const nivelEducacional1A = await obtenerNivelEducacionalDeEquipo(primeroGrupo1);
        const nivelEducacional2B = await obtenerNivelEducacionalDeEquipo(segundoGrupo2);
        
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: primeroGrupo1.curso, 
            paralelo: primeroGrupo1.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: nivelEducacional1A
          },
          equipoB: { 
            curso: segundoGrupo2.curso, 
            paralelo: segundoGrupo2.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: segundoGrupo2.nivelEducacional || "Sin definir"
          },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "semifinales",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: []
        });
        
        const nivelEducacional1B = await obtenerNivelEducacionalDeEquipo(primeroGrupo2);
        const nivelEducacional2A = await obtenerNivelEducacionalDeEquipo(segundoGrupo1);
        
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: primeroGrupo2.curso, 
            paralelo: primeroGrupo2.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: nivelEducacional1B
          },
          equipoB: { 
            curso: segundoGrupo1.curso, 
            paralelo: segundoGrupo1.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: nivelEducacional2A
          },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "semifinales",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: []
        });
        
        partidosCreados = 2;
        showToast(`✅ Semifinales CRUZADAS creadas:\n- ${primeroGrupo1.curso} ${primeroGrupo1.paralelo} vs ${segundoGrupo2.curso} ${segundoGrupo2.paralelo}\n- ${primeroGrupo2.curso} ${primeroGrupo2.paralelo} vs ${segundoGrupo1.curso} ${segundoGrupo1.paralelo}`, "success", 5000);
        
      } else {
        // Directo: 1°A vs 1°B y 2°A vs 2°B
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: primeroGrupo1.curso, 
            paralelo: primeroGrupo1.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: primeroGrupo2.curso, 
            paralelo: primeroGrupo2.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: primeroGrupo2.nivelEducacional || "Sin definir"
          },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "semifinales",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: [],
          genero: filtroGenero,
          categoria: filtroCategoria,
          nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
        });
        
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: segundoGrupo1.curso, 
            paralelo: segundoGrupo1.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: segundoGrupo1.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: segundoGrupo2.curso, 
            paralelo: segundoGrupo2.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: segundoGrupo2.nivelEducacional || "Sin definir"
          },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "semifinales",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: [],
          genero: filtroGenero,
          categoria: filtroCategoria,
          nivelEducacional: segundoGrupo1.nivelEducacional || "Sin definir"
        });
        
        partidosCreados = 2;
        showToast(`✅ Semifinales DIRECTAS creadas:\n- ${primeroGrupo1.curso} ${primeroGrupo1.paralelo} vs ${primeroGrupo2.curso} ${primeroGrupo2.paralelo}\n- ${segundoGrupo1.curso} ${segundoGrupo1.paralelo} vs ${segundoGrupo2.curso} ${segundoGrupo2.paralelo}`, "success", 5000);
      }

      // Crear placeholders para final y tercer puesto
      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: "TBD", 
          paralelo: "Ganador SF1", 
          genero: filtroGenero, 
          categoria: filtroCategoria,
          nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: "TBD", 
          paralelo: "Ganador SF2", 
          genero: filtroGenero, 
          categoria: filtroCategoria,
          nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
        },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "final",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0,
        marcadorB: 0,
        fecha: "",
        hora: "",
        goleadoresA: [],
        goleadoresB: [],
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
      });

      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: "TBD", 
          paralelo: "Perdedor SF1", 
          genero: filtroGenero, 
          categoria: filtroCategoria,
          nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: "TBD", 
          paralelo: "Perdedor SF2", 
          genero: filtroGenero, 
          categoria: filtroCategoria,
          nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
        },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "tercerPuesto",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0,
        marcadorB: 0,
        fecha: "",
        hora: "",
        goleadoresA: [],
        goleadoresB: [],
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: primeroGrupo1.nivelEducacional || "Sin definir"
      });

      partidosCreados += 2;
      
    } catch (error) {
      console.error("Error al generar semifinales:", error);
      showToast("Error al generar semifinales", "error");
    }
  };

  // Función para generar semifinales, final y tercer puesto
  const generarFasesFinales = async () => {
    if (!filtroGenero || !filtroCategoria) {
      showToast("Primero selecciona género y categoría", "warning");
      return;
    }

    try {
      // Obtener equipos de la categoría y género seleccionado
      const equiposFiltrados = equipos.filter(eq => 
        eq.genero === filtroGenero && eq.categoria === filtroCategoria
      );

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Sin grupo";
        if (!equiposPorGrupo[grupo]) {
          equiposPorGrupo[grupo] = [];
        }
        equiposPorGrupo[grupo].push(equipo);
      });

      const gruposConEquipos = Object.keys(equiposPorGrupo).filter(g => equiposPorGrupo[g].length >= 2);

      if (gruposConEquipos.length < 1) {
        showToast("No hay suficientes grupos con equipos para generar fases finales", "warning");
        return;
      }

      // Calcular clasificaciones de cada grupo
      const clasificaciones = {};
      for (const grupo of gruposConEquipos) {
        const partidosGrupo = matches.filter(m => 
          m.grupo === grupo && 
          m.equipoA?.genero === filtroGenero && 
          m.equipoA?.categoria === filtroCategoria &&
          (!m.fase || m.fase === "grupos") &&
          m.estado === "finalizado"
        );
        
        if (partidosGrupo.length === 0) {
          showToast(`El grupo "${grupo}" no tiene partidos finalizados. Completa los partidos de grupos primero.`, "warning");
          return;
        }

        clasificaciones[grupo] = calcularClasificacion(partidosGrupo);
      }

      let partidosCreados = 0;
      const tipoFormato = gruposConEquipos.length === 2 ? "cruzado" : "directo";

      if (gruposConEquipos.length === 2) {
        // Hay 2 grupos: Semifinales cruzadas + Final + Tercer puesto
        const [grupo1, grupo2] = gruposConEquipos;
        const primeroGrupo1 = clasificaciones[grupo1][0];
        const segundoGrupo1 = clasificaciones[grupo1][1];
        const primeroGrupo2 = clasificaciones[grupo2][0];
        const segundoGrupo2 = clasificaciones[grupo2][1];

        if (!primeroGrupo1 || !segundoGrupo1 || !primeroGrupo2 || !segundoGrupo2) {
          showToast("No hay suficientes equipos clasificados en las posiciones necesarias", "warning");
          return;
        }

        // Mostrar modal para seleccionar formato de semifinales
        setModalConfig({
          isOpen: true,
          title: "Seleccionar Formato de Semifinales",
          body: (
            <div className="text-sm space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <h4 className="font-semibold text-blue-700 mb-2">🔄 FORMATO CRUZADO:</h4>
                <ul className="text-blue-600 space-y-1">
                  <li>• {primeroGrupo1.curso} {primeroGrupo1.paralelo} vs {segundoGrupo2.curso} {segundoGrupo2.paralelo}</li>
                  <li>• {primeroGrupo2.curso} {primeroGrupo2.paralelo} vs {segundoGrupo1.curso} {segundoGrupo1.paralelo}</li>
                </ul>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <h4 className="font-semibold text-green-700 mb-2">⚡ FORMATO DIRECTO:</h4>
                <ul className="text-green-600 space-y-1">
                  <li>• {primeroGrupo1.curso} {primeroGrupo1.paralelo} vs {primeroGrupo2.curso} {primeroGrupo2.paralelo}</li>
                  <li>• {segundoGrupo1.curso} {segundoGrupo1.paralelo} vs {segundoGrupo2.curso} {segundoGrupo2.paralelo}</li>
                </ul>
              </div>
            </div>
          ),
          onConfirm: () => {
            setModalConfig({ ...modalConfig, isOpen: false });
            generarSemifinalesConFormato(gruposConEquipos, clasificaciones, true); // CRUZADO
          },
          onCancel: () => {
            setModalConfig({ ...modalConfig, isOpen: false });
            generarSemifinalesConFormato(gruposConEquipos, clasificaciones, false); // DIRECTO
          },
          confirmText: "🔄 Cruzado",
          cancelText: "⚡ Directo"
        });
        
        return; // Salir para evitar ejecutar el código siguiente
      } else if (gruposConEquipos.length === 1) {
        // Solo hay 1 grupo: Los 2 primeros van directo a final, 3° y 4° al tercer puesto
        const grupo = gruposConEquipos[0];
        const clasificacion = clasificaciones[grupo];
        
        if (clasificacion.length < 2) {
          showToast("No hay suficientes equipos en el grupo para generar una final", "warning");
          return;
        }

  const primeroFinalManual = clasificacion[0];
  const segundoFinalManual = clasificacion[1];

        // Crear final
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: primero.curso, 
            paralelo: primero.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: primero.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: segundo.curso, 
            paralelo: segundo.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria,
            nivelEducacional: segundo.nivelEducacional || "Sin definir"
          },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "final",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
        });
        partidosCreados++;

        // Si hay 3° y 4°, crear partido por tercer puesto
        if (clasificacion.length >= 4) {
          const tercero = clasificacion[2];
          const cuarto = clasificacion[3];
          
          await addDoc(collection(db, "matches"), {
            equipoA: { 
              curso: tercero.curso, 
              paralelo: tercero.paralelo, 
              genero: filtroGenero, 
              categoria: filtroCategoria,
              nivelEducacional: tercero.nivelEducacional || "Sin definir"
            },
            equipoB: { 
              curso: cuarto.curso, 
              paralelo: cuarto.paralelo, 
              genero: filtroGenero, 
              categoria: filtroCategoria,
              nivelEducacional: cuarto.nivelEducacional || "Sin definir"
            },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "tercerPuesto",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });
          partidosCreados++;
        }
      }

      if (partidosCreados > 0) {
        showToast(`Se crearon ${partidosCreados} partidos para las fases finales`, "success");
      } else {
        showToast("No se pudieron crear partidos", "warning");
      }

    } catch (error) {
      console.error("Error al generar fases finales:", error);
      showToast("Error al generar fases finales", "error");
    }
  };

  // Función para actualizar partidos existentes con nivel educacional
  const actualizarPartidosConNivelEducacional = async () => {
    try {
      console.log("🔄 Iniciando actualización de partidos con nivel educacional...");
      showToast("🔄 Actualizando partidos con nivel educacional...", "info", 3000);

      const partidosSinNivel = matches.filter(m => 
        !m.equipoA?.nivelEducacional || !m.equipoB?.nivelEducacional
      );

      if (partidosSinNivel.length === 0) {
        showToast("✅ Todos los partidos ya tienen nivel educacional", "success");
        return;
      }

      console.log(`📊 Encontrados ${partidosSinNivel.length} partidos sin nivel educacional`);
      
      let actualizados = 0;

      for (const partido of partidosSinNivel) {
        try {
          // Buscar los equipos correspondientes
          const equipoA = equipos.find(eq => 
            eq.curso === partido.equipoA?.curso && 
            eq.paralelo === partido.equipoA?.paralelo
          );
          
          const equipoB = equipos.find(eq => 
            eq.curso === partido.equipoB?.curso && 
            eq.paralelo === partido.equipoB?.paralelo
          );

          if (equipoA && equipoB && equipoA.nivelEducacional && equipoB.nivelEducacional) {
            // Actualizar el partido con los niveles educacionales
            const partidoRef = doc(db, "matches", partido.id);
            await updateDoc(partidoRef, {
              "equipoA.nivelEducacional": equipoA.nivelEducacional,
              "equipoB.nivelEducacional": equipoB.nivelEducacional
            });
            
            actualizados++;
            console.log(`✓ Actualizado partido ${equipoA.curso} ${equipoA.paralelo} vs ${equipoB.curso} ${equipoB.paralelo}`);
          }
        } catch (error) {
          console.error(`❌ Error actualizando partido ${partido.id}:`, error);
        }
      }

      if (actualizados > 0) {
        showToast(`✅ Se actualizaron ${actualizados} partidos con nivel educacional`, "success");
        // Recargar los datos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast("⚠️ No se pudieron actualizar los partidos", "warning");
      }

    } catch (error) {
      console.error("❌ Error al actualizar partidos:", error);
      showToast("❌ Error al actualizar partidos", "error");
    }
  };

  // Función para verificar y generar fases finales después de finalizar un partido
  const verificarYGenerarFasesFinalesPostPartido = async (partidoFinalizadoId) => {
    return verificarYGenerarFasesFinalesPostPartidoConEstado(partidoFinalizadoId, matches);
  };

  const verificarYGenerarFasesFinalesPostPartidoConEstado = async (partidoFinalizadoId, estadoMatches) => {
    try {
      console.log(`🔍 INICIANDO verificación automática para partido ID: ${partidoFinalizadoId}`);
      console.log(`📊 Total matches recibidos: ${estadoMatches.length}`);
      
      // Obtener el partido que se acaba de finalizar
      const partidoFinalizado = estadoMatches.find(m => m.id === partidoFinalizadoId);
      if (!partidoFinalizado) {
        console.log(`❌ No se encontró el partido finalizado con ID: ${partidoFinalizadoId}`);
        console.log(`📋 IDs disponibles:`, estadoMatches.map(m => m.id));
        return;
      }

      console.log(`✅ Partido finalizado encontrado:`, {
        id: partidoFinalizado.id,
        equipoA: partidoFinalizado.equipoA?.curso + " " + partidoFinalizado.equipoA?.paralelo,
        equipoB: partidoFinalizado.equipoB?.curso + " " + partidoFinalizado.equipoB?.paralelo,
        estado: partidoFinalizado.estado,
        fase: partidoFinalizado.fase || "grupos",
        grupo: partidoFinalizado.grupo
      });

      const genero = partidoFinalizado.equipoA?.genero;
      const categoria = partidoFinalizado.equipoA?.categoria;

      if (!genero || !categoria) {
        console.log(`❌ Partido sin género o categoría válidos`, {
          genero,
          categoria,
          equipoA: partidoFinalizado.equipoA
        });
        return;
      }

      console.log(`🏁 Verificando para ${categoria} - ${genero}`);

      // Obtener todos los partidos de esta categoría y género
      const partidosCategoria = estadoMatches.filter(match => {
        const matchGenero = match.equipoA?.genero;
        const matchCategoria = match.equipoA?.categoria;
        return matchGenero === genero && matchCategoria === categoria;
      });

      console.log(`📊 Total partidos de la categoría: ${partidosCategoria.length}`);
      console.log(`📝 Partidos de la categoría:`, partidosCategoria.map(p => ({
        id: p.id,
        equipoA: p.equipoA?.curso + " " + p.equipoA?.paralelo,
        equipoB: p.equipoB?.curso + " " + p.equipoB?.paralelo,
        estado: p.estado,
        fase: p.fase || "grupos",
        grupo: p.grupo
      })));

      // Verificar si ya existen semifinales o finales
      const semifinalesExistentes = partidosCategoria.filter(match => 
        match.fase === "semifinales" || match.tipo === "semifinal"
      );
      
      const finalesExistentes = partidosCategoria.filter(match => 
        match.fase === "final" || match.tipo === "final"
      );

      console.log(`🔍 Verificando fases finales existentes...`);
      console.log(`✅ Semifinales encontradas: ${semifinalesExistentes.length}`);
      console.log(`✅ Finales encontradas: ${finalesExistentes.length}`);
      
      if (semifinalesExistentes.length > 0) {
        console.log(`✅ Ya existen ${semifinalesExistentes.length} semifinales. No se generarán nuevas.`);
        console.log(`📋 Semifinales existentes:`, semifinalesExistentes.map(s => ({
          id: s.id,
          fase: s.fase,
          tipo: s.tipo,
          equipoA: s.equipoA?.curso + " " + s.equipoA?.paralelo,
          equipoB: s.equipoB?.curso + " " + s.equipoB?.paralelo
        })));
        return;
      }

      if (finalesExistentes.length > 0) {
        console.log(`✅ Ya existen ${finalesExistentes.length} finales. No se generarán nuevas.`);
        console.log(`📋 Finales existentes:`, finalesExistentes.map(f => ({
          id: f.id,
          fase: f.fase,
          tipo: f.tipo,
          equipoA: f.equipoA?.curso + " " + f.equipoA?.paralelo,
          equipoB: f.equipoB?.curso + " " + f.equipoB?.paralelo
        })));
        return;
      }

      // Obtener solo partidos de grupos (incluyendo ida/vuelta y desempate para grupos de 2 equipos)
      const partidosGrupos = partidosCategoria.filter(match => 
        ((!match.fase || match.fase === "grupos") || match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate") && !match.tipo
      );

      console.log(`📋 Partidos de grupos: ${partidosGrupos.length}`);

      // Contar partidos finalizados
      const partidosFinalizados = partidosGrupos.filter(match => 
        match.estado === "finalizado"
      );

      console.log(`✅ Partidos finalizados: ${partidosFinalizados.length}/${partidosGrupos.length}`);

      // Si no todos los partidos están finalizados, no hacer nada
      if (partidosFinalizados.length < partidosGrupos.length) {
        console.log(`⏳ Faltan ${partidosGrupos.length - partidosFinalizados.length} partidos por finalizar`);
        console.log(`📝 Partidos pendientes:`, partidosGrupos.filter(p => p.estado !== "finalizado").map(p => ({
          id: p.id,
          equipoA: p.equipoA?.curso + " " + p.equipoA?.paralelo,
          equipoB: p.equipoB?.curso + " " + p.equipoB?.paralelo,
          estado: p.estado,
          grupo: p.grupo
        })));
        return;
      }

      console.log(`🎉 ¡TODOS LOS PARTIDOS DE GRUPOS FINALIZADOS! Procediendo a generar fases finales...`);

      // Agrupar equipos por grupo
      const equiposCategoria = equipos.filter(eq => eq.genero === genero && eq.categoria === categoria);
      console.log(`👥 Equipos de la categoría encontrados:`, equiposCategoria.length);
      console.log(`📋 Lista de equipos:`, equiposCategoria.map(eq => ({
        curso: eq.curso,
        paralelo: eq.paralelo,
        grupo: eq.grupo,
        genero: eq.genero,
        categoria: eq.categoria
      })));
      
      if (equiposCategoria.length === 0) {
        console.error(`❌ No se encontraron equipos para ${categoria} - ${genero}`);
        console.log(`🔍 DEBUG: Total equipos disponibles: ${equipos.length}`);
        console.log(`🔍 DEBUG: Géneros disponibles: ${[...new Set(equipos.map(eq => eq.genero))].join(", ")}`);
        console.log(`🔍 DEBUG: Categorías disponibles: ${[...new Set(equipos.map(eq => eq.categoria))].join(", ")}`);
        return;
      }
      
      const equiposPorGrupo = {};
      
      equiposCategoria.forEach(equipo => {
        const grupo = equipo.grupo;
        if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
        equiposPorGrupo[grupo].push(equipo);
      });

      console.log(`🗂️ Equipos agrupados:`, equiposPorGrupo);

      const gruposConEquipos = Object.keys(equiposPorGrupo).filter(grupo => 
        equiposPorGrupo[grupo].length >= 2
      );

      console.log(`🏟️ Grupos detectados: ${gruposConEquipos.length}`);
      console.log(`📝 Nombres de grupos:`, gruposConEquipos);
      gruposConEquipos.forEach(grupo => {
        console.log(`  - ${grupo}: ${equiposPorGrupo[grupo].length} equipos`);
        console.log(`    Equipos: ${equiposPorGrupo[grupo].map(eq => eq.curso + " " + eq.paralelo).join(", ")}`);
      });

      // Verificar partidos por grupo
      console.log(`🔍 Verificando partidos por grupo:`);
      gruposConEquipos.forEach(nombreGrupo => {
        const partidosDelGrupo = partidosGrupos.filter(p => p.grupo === nombreGrupo);
        const partidosFinalizadosDelGrupo = partidosDelGrupo.filter(p => p.estado === "finalizado");
        console.log(`  📊 ${nombreGrupo}: ${partidosFinalizadosDelGrupo.length}/${partidosDelGrupo.length} partidos finalizados`);
        
        if (partidosDelGrupo.length > 0) {
          console.log(`    Partidos:`, partidosDelGrupo.map(p => ({
            equipoA: p.equipoA?.curso + " " + p.equipoA?.paralelo,
            equipoB: p.equipoB?.curso + " " + p.equipoB?.paralelo,
            estado: p.estado,
            grupo: p.grupo
          })));
        }
      });

      // Generar semifinales según el número de grupos
      if (gruposConEquipos.length === 1) {
        console.log(`🎯 VERIFICACIÓN CRÍTICA: Generando final directa (1 grupo)`);
        console.log(`   - Grupo detectado: ${gruposConEquipos[0]}`);
        console.log(`   - Equipos en el grupo: ${equiposPorGrupo[gruposConEquipos[0]].length}`);
        console.log(`   - Equipos: ${equiposPorGrupo[gruposConEquipos[0]].map(eq => eq.curso + " " + eq.paralelo).join(", ")}`);
        console.log(`   - Género: ${genero}, Categoría: ${categoria}`);
        
        // Obtener cache de jugadores para niveles educacionales
        console.log(`📋 Obteniendo cache de jugadores...`);
        const jugadoresSnapshot = await getDocs(collection(db, "jugadores"));
        const cacheJugadores = jugadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Cache obtenido: ${cacheJugadores.length} jugadores`);
        
        console.log(`🚀 EJECUTANDO generarFinalGrupoUnico...`);
        await generarFinalGrupoUnico(gruposConEquipos[0], equiposPorGrupo[gruposConEquipos[0]], partidosGrupos, genero, categoria, cacheJugadores, setMatches);
        console.log(`✅ generarFinalGrupoUnico COMPLETADO`);
      } else if (gruposConEquipos.length >= 2) {
        console.log(`🎯 Generando semifinales (${gruposConEquipos.length} grupos)`);
        
        // Calcular clasificaciones de cada grupo
        const clasificadosPorGrupo = {};
        for (const nombreGrupo of gruposConEquipos) {
          const partidosDelGrupo = partidosGrupos.filter(p => p.grupo === nombreGrupo);
          const clasificacion = calcularClasificacion(partidosDelGrupo);
          clasificadosPorGrupo[nombreGrupo] = clasificacion;
          
          console.log(`📊 Clasificación ${nombreGrupo}:`);
          clasificacion.forEach((eq, i) => {
            console.log(`  ${i+1}° ${eq.curso} ${eq.paralelo} (${eq.puntos} pts)`);
          });
        }
        
        await generarSemifinalesAutomaticas(clasificadosPorGrupo, genero, categoria);
      }

      console.log(`✅ Verificación automática completada para ${categoria} - ${genero}`);

    } catch (error) {
      console.error("❌ Error en verificación automática:", error);
      }
  };

  // Función para generar final cuando solo hay un grupo
  const generarFinalGrupoUnico = async (nombreGrupo, equiposGrupo, partidosFiltrados, genero, categoria, cacheJugadores, setMatchesCallback) => {
    try {
      console.log(`🏆 INICIANDO generarFinalGrupoUnico`);
      console.log(`   - Grupo: ${nombreGrupo}`);
      console.log(`   - Equipos: ${equiposGrupo.length}`);
      console.log(`   - Partidos filtrados: ${partidosFiltrados.length}`);
      console.log(`   - Género: ${genero}, Categoría: ${categoria}`);
      console.log(`   - Cache jugadores: ${cacheJugadores ? cacheJugadores.length : 'null'}`);
      console.log(`   - SetMatches callback: ${setMatchesCallback ? 'disponible' : 'no disponible'}`);
      
      // Calcular clasificación final del grupo (incluyendo ida/vuelta y desempate para grupos de 2 equipos)
      const partidosGrupo = partidosFiltrados.filter(match => 
        match.grupo === nombreGrupo && ((!match.fase || match.fase === "grupos") || match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate")
      );
      const clasificacion = calcularClasificacion(partidosGrupo);

      if (clasificacion.length < 2) {
        console.log("❌ No hay suficientes equipos clasificados para generar final");
        return;
      }

      // VALIDACIÓN ESPECIAL: Verificar empate en grupos de 2 equipos
      if (clasificacion.length === 2) {
  const primeroEmpateGrupo = clasificacion[0];
  const segundoEmpateGrupo = clasificacion[1];
        
        console.log(`🔍 Verificando empate en grupo de 2 equipos:`);
  const obtenerNivelEducacionalDeEquipo = async (equipo) => {
        console.log(`  2° ${segundo.curso} ${segundo.paralelo}: ${segundo.puntos} pts (DG: ${segundo.diferencia})`);
        
        // Si están empatados en puntos y diferencia de gol, necesitan desempate
        if (primero.puntos === segundo.puntos && primero.diferencia === segundo.diferencia) {
          console.log(`⚖️ EMPATE DETECTADO: Se requiere partido de desempate`);
          
          // Verificar si ya existe un desempate
          const desempateExistente = partidosGrupo.find(p => p.fase === "desempate");
          if (desempateExistente) {
            console.log(`✅ Ya existe desempate, procediendo con clasificación normal`);
          } else {
            console.log(`🎯 Generando partido de desempate automáticamente`);
            
            // Buscar los equipos en la base de datos
            const equipoPrimero = equipos.find(eq => 
              eq.curso === primero.curso && 
              eq.paralelo === primero.paralelo &&
              eq.genero === genero && 
              eq.categoria === categoria
            );
            const equipoSegundo = equipos.find(eq => 
              eq.curso === segundo.curso && 
              eq.paralelo === segundo.paralelo &&
              eq.genero === genero && 
              eq.categoria === categoria
            );

            if (equipoPrimero && equipoSegundo) {
              const nivelEducacionalA = await obtenerNivelEducacionalConCache(equipoPrimero, cacheJugadores);
              const nivelEducacionalB = await obtenerNivelEducacionalConCache(equipoSegundo, cacheJugadores);
              
              await addDoc(collection(db, "matches"), {
                equipoA: {
                  curso: equipoPrimero.curso,
                  paralelo: equipoPrimero.paralelo,
                  genero: equipoPrimero.genero,
                  categoria: equipoPrimero.categoria,
                  nivelEducacional: nivelEducacionalA
                },
                equipoB: {
                  curso: equipoSegundo.curso,
                  paralelo: equipoSegundo.paralelo,
                  genero: equipoSegundo.genero,
                  categoria: equipoSegundo.categoria,
                  nivelEducacional: nivelEducacionalB
                },
                grupo: nombreGrupo,
                fase: "desempate",
                estado: "programado",
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                fecha: "",
                hora: "",
                goleadoresA: [],
                goleadoresB: [],
                observaciones: "Partido de desempate - Grupo de 2 equipos empatados"
              });

              console.log(`✅ Desempate creado: ${primero.curso} ${primero.paralelo} vs ${segundo.curso} ${segundo.paralelo}`);
              
              showToast(
                `⚖️ ¡Empate detectado!\n\nSe generó automáticamente:\n- Desempate: ${primero.curso} ${primero.paralelo} vs ${segundo.curso} ${segundo.paralelo}\n\nEl ganador pasará a la final.`,
                "warning",
                8000
              );
              
              return; // No generar final hasta que se resuelva el desempate
            }
          }
        }
      }

  const primeroBusqueda = clasificacion[0];
  const segundoBusqueda = clasificacion[1];

      // Buscar los equipos en la base de datos
      const equipoPrimero = equipos.find(eq => 
        eq.curso === primero.curso && 
        eq.paralelo === primero.paralelo &&
        eq.genero === genero && 
        eq.categoria === categoria
      );
      const equipoSegundo = equipos.find(eq => 
        eq.curso === segundo.curso && 
        eq.paralelo === segundo.paralelo &&
        eq.genero === genero && 
        eq.categoria === categoria
      );

      if (!equipoPrimero || !equipoSegundo) {
        console.error("❌ No se encontraron los equipos para la final");
        return;
      }

      // Crear la final con niveles educacionales
      const nivelEducacionalPrimero = await obtenerNivelEducacionalConCache(equipoPrimero, cacheJugadores);
      const nivelEducacionalSegundo = await obtenerNivelEducacionalConCache(equipoSegundo, cacheJugadores);
      
      console.log(`🏆 Creando final: ${equipoPrimero.curso} ${equipoPrimero.paralelo} (${nivelEducacionalPrimero}) vs ${equipoSegundo.curso} ${equipoSegundo.paralelo} (${nivelEducacionalSegundo})`);
      
      const nuevaFinal = {
        equipoA: { 
          curso: equipoPrimero.curso, 
          paralelo: equipoPrimero.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: nivelEducacionalPrimero
        },
        equipoB: { 
          curso: equipoSegundo.curso, 
          paralelo: equipoSegundo.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: nivelEducacionalSegundo
        },
        grupo: `${categoria} - ${genero}`,
        fase: "final",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, 
        marcadorB: 0, 
        fecha: "", 
        hora: "", 
        goleadoresA: [], 
        goleadoresB: []
      };

      const docRef = await addDoc(collection(db, "matches"), nuevaFinal);
      console.log(`✅ Final creada con ID: ${docRef.id}`);
      
      // Actualizar estado de React inmediatamente si el callback está disponible
      if (setMatchesCallback) {
        const finalConId = { ...nuevaFinal, id: docRef.id };
        setMatchesCallback(prev => [...prev, finalConId]);
        console.log(`🔄 Estado de React actualizado automáticamente`);
      }

      console.log(`✅ Final creada: ${primero.curso} ${primero.paralelo} vs ${segundo.curso} ${segundo.paralelo}`);

      // VALIDACIÓN ESPECIAL: Solo crear tercer puesto si hay 4+ equipos (no para grupos de 3)
      if (clasificacion.length >= 4) {
        console.log(`🏆 Creando partido por 3er puesto (${clasificacion.length} equipos en el grupo)`);
      } else if (clasificacion.length === 3) {
        console.log(`⚠️ Grupo de 3 equipos: NO se crea partido por 3er puesto (solo final entre los 2 primeros)`);
      }

      // Si hay al menos 4 equipos, crear partido por tercer puesto
      if (clasificacion.length >= 4) {
        const tercero = clasificacion[2];
        const cuarto = clasificacion[3];
        
        const equipoTercero = equipos.find(eq => 
          eq.curso === tercero.curso && 
          eq.paralelo === tercero.paralelo &&
          eq.genero === genero && 
          eq.categoria === categoria
        );
        const equipoCuarto = equipos.find(eq => 
          eq.curso === cuarto.curso && 
          eq.paralelo === cuarto.paralelo &&
          eq.genero === genero && 
          eq.categoria === categoria
        );

        if (equipoTercero && equipoCuarto) {
          const nivelEducacionalTercero = await obtenerNivelEducacionalConCache(equipoTercero, cacheJugadores);
          const nivelEducacionalCuarto = await obtenerNivelEducacionalConCache(equipoCuarto, cacheJugadores);
          
          const nuevoTercerPuesto = {
            equipoA: { 
              curso: equipoTercero.curso, 
              paralelo: equipoTercero.paralelo, 
              genero: genero, 
              categoria: categoria,
              nivelEducacional: nivelEducacionalTercero
            },
            equipoB: { 
              curso: equipoCuarto.curso, 
              paralelo: equipoCuarto.paralelo, 
              genero: genero, 
              categoria: categoria,
              nivelEducacional: nivelEducacionalCuarto
            },
            grupo: `${categoria} - ${genero}`,
            fase: "tercerPuesto",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, 
            marcadorB: 0, 
            fecha: "", 
            hora: "", 
            goleadoresA: [], 
            goleadoresB: []
          };

          const docRefTercero = await addDoc(collection(db, "matches"), nuevoTercerPuesto);
          console.log(`✅ Partido por 3er puesto creado con ID: ${docRefTercero.id}`);
          
          // Actualizar estado de React si el callback está disponible
          if (setMatchesCallback) {
            const tercerPuestoConId = { ...nuevoTercerPuesto, id: docRefTercero.id };
            setMatchesCallback(prev => [...prev, tercerPuestoConId]);
            console.log(`🔄 Estado de React actualizado para tercer puesto`);
          }
        }
      }

      try {
        // Mostrar notificación al usuario según el tipo de grupo
        let mensaje = `🏆 ¡Fase de grupos completada!\n\nSe generaron automáticamente:\n- Final: ${primeroFinalManual.curso} ${primeroFinalManual.paralelo} vs ${segundoFinalManual.curso} ${segundoFinalManual.paralelo}`;
        
        if (clasificacion.length === 3) {
          mensaje += `\n\n⚠️ Grupo de 3 equipos: Solo se juega la final entre los 2 primeros`;
        } else if (clasificacion.length >= 4) {
          mensaje += `\n- 3er puesto: ${clasificacion[2].curso} ${clasificacion[2].paralelo} vs ${clasificacion[3].curso} ${clasificacion[3].paralelo}`;
        }

        showToast(mensaje, "success", 6000);
      } catch (error) {
        console.error("❌ Error al generar final de grupo único:", error);
      }
    }

  // Función para generar semifinales automáticas cuando hay múltiples grupos
  const generarSemifinalesAutomaticas = async (clasificadosPorGrupo, genero, categoria) => {
    try {
      console.log(`🏆 INICIANDO generación de semifinales automáticas`);
      console.log(`📊 Clasificados por grupo recibidos:`, clasificadosPorGrupo);
      
      const gruposNombres = Object.keys(clasificadosPorGrupo);
      console.log(`🏟️ Grupos disponibles: ${gruposNombres.length}`, gruposNombres);
      
      if (gruposNombres.length < 2) {
        console.log("❌ Se necesitan al menos 2 grupos para generar semifinales");
        return;
      }

      // Para simplicidad, tomar los primeros 2 grupos (esto se puede mejorar)
      const grupo1 = gruposNombres[0];
      const grupo2 = gruposNombres[1];
      
      console.log(`🎯 Procesando ${grupo1} vs ${grupo2}`);
      
      const clasificacionGrupo1 = clasificadosPorGrupo[grupo1];
      const clasificacionGrupo2 = clasificadosPorGrupo[grupo2];

      console.log(`📋 Clasificación ${grupo1}:`, clasificacionGrupo1);
      console.log(`📋 Clasificación ${grupo2}:`, clasificacionGrupo2);

      if (clasificacionGrupo1.length < 2 || clasificacionGrupo2.length < 2) {
        console.log("❌ No hay suficientes equipos clasificados en ambos grupos");
        console.log(`   ${grupo1}: ${clasificacionGrupo1.length} equipos`);
        console.log(`   ${grupo2}: ${clasificacionGrupo2.length} equipos`);
        return;
      }

      const primeroGrupo1 = clasificacionGrupo1[0];
      const segundoGrupo1 = clasificacionGrupo1[1];
      const primeroGrupo2 = clasificacionGrupo2[0];
      const segundoGrupo2 = clasificacionGrupo2[1];

      console.log(`🥇 1° ${grupo1}: ${primeroGrupo1.curso} ${primeroGrupo1.paralelo}`);
      console.log(`🥈 2° ${grupo1}: ${segundoGrupo1.curso} ${segundoGrupo1.paralelo}`);
      console.log(`🥇 1° ${grupo2}: ${primeroGrupo2.curso} ${primeroGrupo2.paralelo}`);
      console.log(`🥈 2° ${grupo2}: ${segundoGrupo2.curso} ${segundoGrupo2.paralelo}`);

      // Buscar los equipos en la base de datos
      const buscarEquipo = (clasificado) => {
        return equipos.find(eq => 
          eq.curso === clasificado.curso && 
          eq.paralelo === clasificado.paralelo &&
          eq.genero === genero && 
          eq.categoria === categoria
        );
      };

      const equipoPrimeroGrupo1 = buscarEquipo(primeroGrupo1);
      const equipoSegundoGrupo1 = buscarEquipo(segundoGrupo1);
      const equipoPrimeroGrupo2 = buscarEquipo(primeroGrupo2);
      const equipoSegundoGrupo2 = buscarEquipo(segundoGrupo2);

      if (!equipoPrimeroGrupo1 || !equipoSegundoGrupo1 || !equipoPrimeroGrupo2 || !equipoSegundoGrupo2) {
        console.error("❌ No se encontraron todos los equipos para las semifinales");
        return;
      }

      // Crear semifinales cruzadas: 1°Grupo1 vs 2°Grupo2, 1°Grupo2 vs 2°Grupo1
      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: equipoPrimeroGrupo1.curso, 
          paralelo: equipoPrimeroGrupo1.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo1.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: equipoSegundoGrupo2.curso, 
          paralelo: equipoSegundoGrupo2.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoSegundoGrupo2.nivelEducacional || "Sin definir"
        },
        grupo: `${categoria} - ${genero}`,
        fase: "semifinales",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, 
        marcadorB: 0, 
        fecha: "", 
        hora: "", 
        goleadoresA: [], 
        goleadoresB: []
      });

      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: equipoPrimeroGrupo2.curso, 
          paralelo: equipoPrimeroGrupo2.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo2.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: equipoSegundoGrupo1.curso, 
          paralelo: equipoSegundoGrupo1.paralelo, 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoSegundoGrupo1.nivelEducacional || "Sin definir"
        },
        grupo: `${categoria} - ${genero}`,
        fase: "semifinales",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, 
        marcadorB: 0, 
        fecha: "", 
        hora: "", 
        goleadoresA: [], 
        goleadoresB: []
      });

      // Crear placeholders para final y tercer puesto (se definirán después de semifinales)
      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: "TBD", 
          paralelo: "Ganador SF1", 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo1.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: "TBD", 
          paralelo: "Ganador SF2", 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo1.nivelEducacional || "Sin definir"
        },
        grupo: `${categoria} - ${genero}`,
        fase: "final",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, 
        marcadorB: 0, 
        fecha: "", 
        hora: "", 
        goleadoresA: [], 
        goleadoresB: []
      });

      await addDoc(collection(db, "matches"), {
        equipoA: { 
          curso: "TBD", 
          paralelo: "Perdedor SF1", 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo1.nivelEducacional || "Sin definir"
        },
        equipoB: { 
          curso: "TBD", 
          paralelo: "Perdedor SF2", 
          genero: genero, 
          categoria: categoria,
          nivelEducacional: equipoPrimeroGrupo1.nivelEducacional || "Sin definir"
        },
        grupo: `${categoria} - ${genero}`,
        fase: "tercerPuesto",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, 
        marcadorB: 0, 
        fecha: "", 
        hora: "", 
        goleadoresA: [], 
        goleadoresB: []
      });

      console.log("✅ Semifinales, final y tercer puesto generados automáticamente");

      // Mostrar notificación al usuario
      showToast(
        `🏆 ¡Fase de grupos completada!\n\nSe generaron automáticamente:\n- Semifinal 1: ${primeroGrupo1.curso} ${primeroGrupo1.paralelo} vs ${segundoGrupo2.curso} ${segundoGrupo2.paralelo}\n- Semifinal 2: ${primeroGrupo2.curso} ${primeroGrupo2.paralelo} vs ${segundoGrupo1.curso} ${segundoGrupo1.paralelo}\n- Final y 3er puesto se definirán después de semifinales`,
        "success",
        6000
      );

    } catch (error) {
      console.error("❌ Error al generar semifinales automáticas:", error);
    }

  // Función para verificar y actualizar final/tercer puesto cuando se completan las semifinales
  const verificarYActualizarFinalesPostSemifinales = async (partidoFinalizadoId) => {
    try {
      console.log(`🔍 INICIANDO verificación de finales post-semifinales para partido ID: ${partidoFinalizadoId}`);
      
      // Obtener datos frescos de la base de datos
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      const todosLosPartidos = matchesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(m => m.disciplina === discipline);
      
      console.log(`📊 Datos frescos obtenidos: ${todosLosPartidos.length} partidos`);
      
      // Obtener el partido que se acaba de finalizar
      const partidoFinalizado = todosLosPartidos.find(m => m.id === partidoFinalizadoId);
      if (!partidoFinalizado) {
        console.log(`❌ No se encontró el partido finalizado con ID: ${partidoFinalizadoId}`);
        return;
      }
      
      console.log(`✅ Partido finalizado encontrado:`, {
        id: partidoFinalizado.id,
        fase: partidoFinalizado.fase,
        equipoA: partidoFinalizado.equipoA?.curso + " " + partidoFinalizado.equipoA?.paralelo,
        equipoB: partidoFinalizado.equipoB?.curso + " " + partidoFinalizado.equipoB?.paralelo,
        marcadorA: partidoFinalizado.marcadorA,
        marcadorB: partidoFinalizado.marcadorB
      });
      
      if (partidoFinalizado.fase !== "semifinales") {
        console.log(`ℹ️ El partido no es una semifinal (fase: ${partidoFinalizado.fase}), no se procesará`);
        return;
      }

      const genero = partidoFinalizado.equipoA?.genero || partidoFinalizado.genero;
      const categoria = partidoFinalizado.equipoA?.categoria || partidoFinalizado.categoria;

      if (!genero || !categoria) {
        console.log(`❌ No se pudieron determinar género o categoría`, { genero, categoria });
        return;
      }

      console.log(`🏆 Semifinal finalizada - Verificando si se pueden actualizar finales para ${categoria} (${genero})`);

      // Filtrar todas las semifinales de esta categoría y género (incluyendo las que no son placeholder)
      const semifinales = todosLosPartidos.filter(match => {
        const matchGenero = match.equipoA?.genero || match.genero;
        const matchCategoria = match.equipoA?.categoria || match.categoria;
        return matchGenero === genero && 
               matchCategoria === categoria && 
               match.fase === "semifinales" &&
               match.equipoA?.curso !== "TBD" && // Excluir placeholders
               match.equipoB?.curso !== "TBD";   // Excluir placeholders
      });

      console.log(`🔍 Total de partidos analizados: ${todosLosPartidos.length}`);
      console.log(`📊 Criterios de filtro: genero=${genero}, categoria=${categoria}, fase=semifinales`);
      console.log(`📋 Semifinales encontradas: ${semifinales.length}`);
      semifinales.forEach((sf, i) => {
        console.log(`  SF${i+1}: ${sf.equipoA?.curso} ${sf.equipoA?.paralelo} vs ${sf.equipoB?.curso} ${sf.equipoB?.paralelo} (${sf.estado}) - ID: ${sf.id}`);
      });

      // Verificar que todas las semifinales estén finalizadas
      const semifinalesFinalizadas = semifinales.filter(match => match.estado === "finalizado");
      
      console.log(`📊 Semifinales: ${semifinalesFinalizadas.length}/${semifinales.length} finalizadas`);

      if (semifinalesFinalizadas.length < semifinales.length) {
        console.log("⏳ Aún faltan semifinales por finalizar");
        return;
      }

      if (semifinalesFinalizadas.length < 2) {
        console.log("❌ No hay suficientes semifinales finalizadas");
        return;
      }

      // Determinar ganadores y perdedores de las semifinales
      const resultadosSemifinales = semifinalesFinalizadas.map((match, index) => {
        const marcadorA = match.marcadorA || 0;
        const marcadorB = match.marcadorB || 0;
        
        let ganador, perdedor;
        if (marcadorA > marcadorB) {
          ganador = { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo };
          perdedor = { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo };
        } else {
          ganador = { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo };
          perdedor = { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo };
        }
        
        return { ganador, perdedor, semiFinalIndex: index + 1 };
      });

      console.log("🎯 Resultados de semifinales:", resultadosSemifinales);

      // Buscar los partidos placeholder de final y tercer puesto
      console.log(`🔍 Buscando partidos existentes de final y tercer puesto...`);
      
      let partidoFinal = todosLosPartidos.find(match => 
        match.equipoA?.genero === genero && 
        match.equipoA?.categoria === categoria && 
        match.fase === "final" &&
        (match.equipoA?.curso === "TBD" || match.equipoB?.curso === "TBD")
      );

      let partidoTercerPuesto = todosLosPartidos.find(match => 
        match.equipoA?.genero === genero && 
        match.equipoA?.categoria === categoria && 
        match.fase === "tercerPuesto" &&
        (match.equipoA?.curso === "TBD" || match.equipoB?.curso === "TBD")
      );

      console.log(`🏆 Partido de final existente:`, partidoFinal ? `ID: ${partidoFinal.id}` : "No encontrado");
      console.log(`🥉 Partido de tercer puesto existente:`, partidoTercerPuesto ? `ID: ${partidoTercerPuesto.id}` : "No encontrado");

      // Si no existen partidos placeholder, crearlos
      if (!partidoFinal && resultadosSemifinales.length >= 2) {
        console.log("🏆 Creando partido de final automáticamente...");
        const docRef = await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: "TBD", 
            paralelo: "Ganador SF1", 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: resultadosSemifinales[0]?.ganador?.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: "TBD", 
            paralelo: "Ganador SF2", 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: resultadosSemifinales[0]?.ganador?.nivelEducacional || "Sin definir"
          },
          grupo: `${categoria} - ${genero}`,
          fase: "final",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, 
          marcadorB: 0, 
          fecha: "", 
          hora: "", 
          goleadoresA: [], 
          goleadoresB: []
        });
        
        // Obtener el partido recién creado
        partidoFinal = { id: docRef.id, equipoA: { curso: "TBD" }, equipoB: { curso: "TBD" } };
      }

      if (!partidoTercerPuesto && resultadosSemifinales.length >= 2) {
        console.log("🥉 Creando partido de tercer puesto automáticamente...");
        const docRef = await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: "TBD", 
            paralelo: "Perdedor SF1", 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: resultadosSemifinales[0]?.perdedor?.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: "TBD", 
            paralelo: "Perdedor SF2", 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: resultadosSemifinales[0]?.perdedor?.nivelEducacional || "Sin definir"
          },
          grupo: `${categoria} - ${genero}`,
          fase: "tercerPuesto",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, 
          marcadorB: 0, 
          fecha: "", 
          hora: "", 
          goleadoresA: [], 
          goleadoresB: []
        });
        
        // Obtener el partido recién creado
        partidoTercerPuesto = { id: docRef.id, equipoA: { curso: "TBD" }, equipoB: { curso: "TBD" } };
      }

      // Actualizar final con los ganadores
      if (partidoFinal && resultadosSemifinales.length >= 2) {
        const ganador1 = resultadosSemifinales[0].ganador;
        const ganador2 = resultadosSemifinales[1].ganador;

        await updateDoc(doc(db, "matches", partidoFinal.id), {
          equipoA: { 
            curso: ganador1.curso, 
            paralelo: ganador1.paralelo, 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: ganador1.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: ganador2.curso, 
            paralelo: ganador2.paralelo, 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: ganador2.nivelEducacional || "Sin definir"
          }
        });

        console.log(`✅ Final actualizada: ${ganador1.curso} ${ganador1.paralelo} vs ${ganador2.curso} ${ganador2.paralelo}`);
      }

      // Actualizar tercer puesto con los perdedores
      if (partidoTercerPuesto && resultadosSemifinales.length >= 2) {
        const perdedor1 = resultadosSemifinales[0].perdedor;
        const perdedor2 = resultadosSemifinales[1].perdedor;

        await updateDoc(doc(db, "matches", partidoTercerPuesto.id), {
          equipoA: { 
            curso: perdedor1.curso, 
            paralelo: perdedor1.paralelo, 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: perdedor1.nivelEducacional || "Sin definir"
          },
          equipoB: { 
            curso: perdedor2.curso, 
            paralelo: perdedor2.paralelo, 
            genero: genero, 
            categoria: categoria,
            nivelEducacional: perdedor2.nivelEducacional || "Sin definir"
          }
        });

        console.log(`✅ Tercer puesto actualizado: ${perdedor1.curso} ${perdedor1.paralelo} vs ${perdedor2.curso} ${perdedor2.paralelo}`);
      }

      // Mostrar notificación al usuario
      if (partidoFinal && partidoTercerPuesto) {
        const ganador1 = resultadosSemifinales[0].ganador;
        const ganador2 = resultadosSemifinales[1].ganador;
        const perdedor1 = resultadosSemifinales[0].perdedor;
        const perdedor2 = resultadosSemifinales[1].perdedor;

        showToast(
          `🏆 ¡Semifinales completadas!\n\nSe actualizaron automáticamente:\n- Final: ${ganador1.curso} ${ganador1.paralelo} vs ${ganador2.curso} ${ganador2.paralelo}\n- 3er puesto: ${perdedor1.curso} ${perdedor1.paralelo} vs ${perdedor2.curso} ${perdedor2.paralelo}`,
          "success",
          6000
        );
      }

    } catch (error) {
      console.error("❌ Error al verificar y actualizar finales post-semifinales:", error);
    }
  };

  // Función para verificar y generar finales directas (para casos especiales)
  const verificarYGenerarFinalesDirectas = async (partidoFinalizadoId) => {
    try {
      // Obtener el partido que se acaba de finalizar
      const partidoFinalizado = matches.find(m => m.id === partidoFinalizadoId);
      if (!partidoFinalizado) return;

      const genero = partidoFinalizado.equipoA?.genero || partidoFinalizado.genero;
      const categoria = partidoFinalizado.equipoA?.categoria || partidoFinalizado.categoria;

      if (!genero || !categoria) return;

      // Si el partido finalizado no es una semifinal, no hacer nada
      if (partidoFinalizado.fase !== "semifinales") return;

      console.log(`🔍 Verificando si necesitamos generar finales directas para ${categoria} (${genero})`);

      // Buscar todas las semifinales finalizadas (incluyendo las manuales)
      const semifinalesFinalizadas = matches.filter(match => {
        const matchGenero = match.equipoA?.genero || match.genero;
        const matchCategoria = match.equipoA?.categoria || match.categoria;
        return matchGenero === genero && 
               matchCategoria === categoria && 
               match.fase === "semifinales" &&
               match.estado === "finalizado" &&
               match.equipoA?.curso !== "TBD" && 
               match.equipoB?.curso !== "TBD";
      });

      console.log(`📊 Semifinales finalizadas encontradas: ${semifinalesFinalizadas.length}`);

      // Si tenemos al menos 2 semifinales finalizadas, verificar si existe final
      if (semifinalesFinalizadas.length >= 2) {
        const finalesExistentes = matches.filter(match => {
          const matchGenero = match.equipoA?.genero || match.genero;
          const matchCategoria = match.equipoA?.categoria || match.categoria;
          return matchGenero === genero && 
                 matchCategoria === categoria && 
                 match.fase === "final";
        });

        console.log(`🏆 Finales existentes: ${finalesExistentes.length}`);

        // Si no hay finales, crear directamente con los ganadores de semifinales
        if (finalesExistentes.length === 0) {
          console.log("🚀 Generando final directamente desde semifinales...");

          // Determinar ganadores de las primeras 2 semifinales
          const ganadores = semifinalesFinalizadas.slice(0, 2).map(match => {
            const marcadorA = match.marcadorA || 0;
            const marcadorB = match.marcadorB || 0;
            
            if (marcadorA > marcadorB) {
              return { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo };
            } else {
              return { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo };
            }
          });

          if (ganadores.length >= 2) {
            // Crear final directa
            await addDoc(collection(db, "matches"), {
              equipoA: { 
                curso: ganadores[0].curso, 
                paralelo: ganadores[0].paralelo, 
                genero: genero, 
                categoria: categoria 
              },
              equipoB: { 
                curso: ganadores[1].curso, 
                paralelo: ganadores[1].paralelo, 
                genero: genero, 
                categoria: categoria 
              },
              grupo: `${categoria} - ${genero}`,
              fase: "final",
              estado: "programado",
              disciplina: discipline,
              marcadorA: 0, 
              marcadorB: 0, 
              fecha: "", 
              hora: "", 
              goleadoresA: [], 
              goleadoresB: []
            });

            console.log(`✅ Final generada directamente: ${ganadores[0].curso} ${ganadores[0].paralelo} vs ${ganadores[1].curso} ${ganadores[1].paralelo}`);

            // También crear tercer puesto con los perdedores
            const perdedores = semifinalesFinalizadas.slice(0, 2).map(match => {
              const marcadorA = match.marcadorA || 0;
              const marcadorB = match.marcadorB || 0;
              
              if (marcadorA > marcadorB) {
                return { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo };
              } else {
                return { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo };
              }
            });

            if (perdedores.length >= 2) {
              await addDoc(collection(db, "matches"), {
                equipoA: { 
                  curso: perdedores[0].curso, 
                  paralelo: perdedores[0].paralelo, 
                  genero: genero, 
                  categoria: categoria 
                },
                equipoB: { 
                  curso: perdedores[1].curso, 
                  paralelo: perdedores[1].paralelo, 
                  genero: genero, 
                  categoria: categoria 
                },
                grupo: `${categoria} - ${genero}`,
                fase: "tercerPuesto",
                estado: "programado",
                disciplina: discipline,
                marcadorA: 0, 
                marcadorB: 0, 
                fecha: "", 
                hora: "", 
                goleadoresA: [], 
                goleadoresB: []
              });

              console.log(`✅ Tercer puesto generado: ${perdedores[0].curso} ${perdedores[0].paralelo} vs ${perdedores[1].curso} ${perdedores[1].paralelo}`);
            }

            // Mostrar notificación
            showToast(
              `🏆 ¡Semifinales completadas!\n\nSe generaron automáticamente:\n- Final: ${ganadores[0].curso} ${ganadores[0].paralelo} vs ${ganadores[1].curso} ${ganadores[1].paralelo}\n- 3er puesto: ${perdedores[0].curso} ${perdedores[0].paralelo} vs ${perdedores[1].curso} ${perdedores[1].paralelo}`,
              "success",
              6000
            );
          }
        }
      }

    } catch (error) {
      console.error("❌ Error al verificar y generar finales directas:", error);
    }
  };

  // Función antigua eliminada - reemplazada por generarSemifinalesAutomaticas

  const generarSiguienteFase = async (faseActual) => {
    if (faseActual === "finales") return; // No hay fase después de finales
    
    // MODIFICADO: Deshabilitar generación automática de grupos2 y grupos3
    // Solo permitir generación automática de semifinales y finales
    const fasesSiguientes = {
      // "grupos1": "grupos2",  // Deshabilitado
      // "grupos2": "grupos3",  // Deshabilitado
      // "grupos3": "semifinales", // Deshabilitado - ahora se maneja por verificarYGenerarFasesFinalesPostPartidoConEstado
      "semifinales": "finales"
    };
    
    const siguienteFase = fasesSiguientes[faseActual];
    if (!siguienteFase) {
      console.log(`⚠️ AVISO: Intento de generar siguiente fase para "${faseActual}" pero está deshabilitado`);
      return;
    }
    
    // Verificar si ya existen partidos en la siguiente fase
    const partidosSiguienteFase = matches.filter(m => m.fase === siguienteFase);
    if (partidosSiguienteFase.length > 0) return;
    
    try {
      // Obtener clasificados de la fase actual
      const clasificados = [];
      
      if (faseActual.includes("grupos")) {
        // Para fases de grupos, obtener equipos según la lógica específica
        for (const grupo of grupos) {
          // Obtener todos los partidos finalizados hasta la fase actual
          const partidosCompletos = matches.filter(m => 
            m.grupo === grupo && 
            m.estado === "finalizado" &&
            (m.fase === "grupos1" || m.fase === "grupos2" || m.fase === "grupos3")
          );
          
          if (partidosCompletos.length > 0) {
            const clasificacionGrupo = calcularClasificacion(partidosCompletos);
            
            if (siguienteFase === "grupos2") {
              // Fase 2: Solo equipos que NO tienen 2 partidos jugados
              const equiposParaFase2 = clasificacionGrupo.filter(equipo => equipo.partidos < 2);
              clasificados.push(...equiposParaFase2);
            } else if (siguienteFase === "grupos3") {
              // Fase 3: Solo equipos que NO tienen 3 partidos jugados
              const equiposParaFase3 = clasificacionGrupo.filter(equipo => equipo.partidos < 3);
              clasificados.push(...equiposParaFase3);
            } else if (siguienteFase === "semifinales") {
              // Semifinales: Top 4 de cada grupo, pero solo los que hayan jugado 3 partidos
              const equiposConTresPartidos = clasificacionGrupo.filter(equipo => equipo.partidos === 3);
              clasificados.push(...equiposConTresPartidos.slice(0, 4));
            }
          }
        }
      } else if (faseActual === "semifinales") {
        // Para finales, obtener ganadores de semifinales
        const semifinales = matches.filter(m => m.fase === "semifinales" && m.estado === "finalizado");
        semifinales.forEach(match => {
          const ganador = (match.marcadorA || 0) > (match.marcadorB || 0) 
            ? { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo, grupo: match.grupo }
            : { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo, grupo: match.grupo };
          clasificados.push(ganador);
        });
      }
      
      if (clasificados.length < 2) return;
      
      // Generar partidos para la siguiente fase
      const nuevosPartidos = [];
      
      if (siguienteFase === "finales") {
        // Final: los 2 ganadores de semifinales
        if (clasificados.length >= 2) {
          nuevosPartidos.push({
            equipoA: { curso: clasificados[0].curso, paralelo: clasificados[0].paralelo },
            equipoB: { curso: clasificados[1].curso, paralelo: clasificados[1].paralelo },
            disciplina: discipline,
            marcadorA: 0,
            marcadorB: 0,
            estado: "pendiente",
            fecha: null,
            hora: null,
            grupo: clasificados[0].grupo,
            fase: siguienteFase,
            goleadoresA: [],
            goleadoresB: [],
            ...(discipline === "voley" && {
              sets: Array(5).fill({ A: 0, B: 0 }),
              anotadoresA: [],
              anotadoresB: []
            })
          });
        }
      } else if (siguienteFase === "semifinales") {
        // Semifinales: 1° vs 4°, 2° vs 3° por grupo
        const gruposClasificados = {};
        clasificados.forEach(equipo => {
          if (!gruposClasificados[equipo.grupo]) gruposClasificados[equipo.grupo] = [];
          gruposClasificados[equipo.grupo].push(equipo);
        });
        
        Object.entries(gruposClasificados).forEach(([grupo, equiposGrupo]) => {
          if (equiposGrupo.length >= 4) {
            // 1° vs 4°
            nuevosPartidos.push({
              equipoA: { curso: equiposGrupo[0].curso, paralelo: equiposGrupo[0].paralelo },
              equipoB: { curso: equiposGrupo[3].curso, paralelo: equiposGrupo[3].paralelo },
              disciplina: discipline,
              marcadorA: 0,
              marcadorB: 0,
              estado: "pendiente",
              fecha: null,
              hora: null,
              grupo: grupo,
              fase: siguienteFase,
              goleadoresA: [],
              goleadoresB: [],
              ...(discipline === "voley" && {
                sets: Array(5).fill({ A: 0, B: 0 }),
                anotadoresA: [],
                anotadoresB: []
              })
            });
            
            // 2° vs 3°
            nuevosPartidos.push({
              equipoA: { curso: equiposGrupo[1].curso, paralelo: equiposGrupo[1].paralelo },
              equipoB: { curso: equiposGrupo[2].curso, paralelo: equiposGrupo[2].paralelo },
              disciplina: discipline,
              marcadorA: 0,
              marcadorB: 0,
              estado: "pendiente",
              fecha: null,
              hora: null,
              grupo: grupo,
              fase: siguienteFase,
              goleadoresA: [],
              goleadoresB: [],
              ...(discipline === "voley" && {
                sets: Array(5).fill({ A: 0, B: 0 }),
                anotadoresA: [],
                anotadoresB: []
              })
            });
          }
        });
      } else {
        // Para grupos2 y grupos3: enfrentar equipos según posición en tabla
        const gruposClasificados = {};
        clasificados.forEach(equipo => {
          if (!gruposClasificados[equipo.grupo]) gruposClasificados[equipo.grupo] = [];
          gruposClasificados[equipo.grupo].push(equipo);
        });
        
        Object.entries(gruposClasificados).forEach(([grupo, equiposGrupo]) => {
          // Ordenar equipos por posición (ya vienen ordenados por calcularClasificacion)
          let equiposOrdenados = [...equiposGrupo];
          
          // Si hay número impar de equipos, eliminar el último clasificado
          if (equiposOrdenados.length % 2 !== 0) {
            console.log(`Eliminando último clasificado del ${grupo}: ${equiposOrdenados[equiposOrdenados.length - 1].nombre}`);
            equiposOrdenados.pop(); // Eliminar el último equipo
          }
          
          // Crear partidos basados en posiciones: 1°vs último, 2°vs penúltimo, etc.
          if (equiposOrdenados.length >= 2) {
            for (let i = 0; i < Math.floor(equiposOrdenados.length / 2); i++) {
              const equipoA = equiposOrdenados[i];
              const equipoB = equiposOrdenados[equiposOrdenados.length - 1 - i];
              
              nuevosPartidos.push({
                equipoA: { curso: equipoA.curso, paralelo: equipoA.paralelo },
                equipoB: { curso: equipoB.curso, paralelo: equipoB.paralelo },
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                estado: "pendiente",
                fecha: null,
                hora: null,
                grupo: grupo,
                fase: siguienteFase,
                goleadoresA: [],
                goleadoresB: [],
                ...(discipline === "voley" && {
                  sets: siguienteFase.includes("grupos") ? [{ A: 0, B: 0 }] : Array(5).fill({ A: 0, B: 0 }),
                  anotadoresA: [],
                  anotadoresB: []
                })
              });
            }
          }
        });
      }
      
      // Guardar nuevos partidos en Firestore
      if (nuevosPartidos.length > 0) {
        for (const partido of nuevosPartidos) {
          await addDoc(collection(db, "matches"), partido);
        }
        
        console.log(`Generados ${nuevosPartidos.length} partidos para ${fasesDb[siguienteFase]}`);
      }
      
    } catch (error) {
      console.error("Error al generar siguiente fase:", error);
    }
  };

  // Función para obtener equipos clasificados por puntos
  const obtenerClasificacion = async (discipline) => {
    try {
      const matchesQuery = query(
        collection(db, "matches"),
        where("disciplina", "==", discipline),
        where("estado", "==", "finalizado"),
      );
      const matchesSnapshot = await getDocs(matchesQuery);
      const matches = matchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calcular puntos por equipo
      const equipos = {};

      matches.forEach((match) => {
        const equipoAKey = `${match.equipoA.curso}${match.equipoA.paralelo}`;
        const equipoBKey = `${match.equipoB.curso}${match.equipoB.paralelo}`;

        if (!equipos[equipoAKey]) {
          equipos[equipoAKey] = {
            curso: match.equipoA.curso,
            paralelo: match.equipoA.paralelo,
            puntos: 0,
            puntosAnotados: 0,
            puntosRecibidos: 0,
            partidos: 0,
          };
        }

        if (!equipos[equipoBKey]) {
          equipos[equipoBKey] = {
            curso: match.equipoB.curso,
            paralelo: match.equipoB.paralelo,
            puntos: 0,
            puntosAnotados: 0,
            puntosRecibidos: 0,
            partidos: 0,
          };
        }

        // Sumar estadísticas
        equipos[equipoAKey].puntosAnotados += match.marcadorA || 0;
        equipos[equipoAKey].puntosRecibidos += match.marcadorB || 0;
        equipos[equipoAKey].partidos++;

        equipos[equipoBKey].puntosAnotados += match.marcadorB || 0;
        equipos[equipoBKey].puntosRecibidos += match.marcadorA || 0;
        equipos[equipoBKey].partidos++;

        // Asignar puntos por victoria/empate/derrota
        if (discipline === "voley") {
          // En vóley no hay empates
          if (match.marcadorA > match.marcadorB) {
            equipos[equipoAKey].puntos += 3;
          } else {
            equipos[equipoBKey].puntos += 3;
          }
        } else {
          // Fútbol
          if (match.marcadorA > match.marcadorB) {
            equipos[equipoAKey].puntos += 3;
          } else if (match.marcadorA < match.marcadorB) {
            equipos[equipoBKey].puntos += 3;
          } else {
            equipos[equipoAKey].puntos += 1;
            equipos[equipoBKey].puntos += 1;
          }
        }
      });

      // Convertir a array y ordenar
      return Object.values(equipos).sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        const difA = a.puntosAnotados - a.puntosRecibidos;
        const difB = b.puntosAnotados - b.puntosRecibidos;
        return difB - difA;
      });
    } catch (error) {
      console.error("Error al obtener clasificación:", error);
      return [];
    }
  };

  // Función para recargar partidos
  const fetchMatches = () => {
    // Esta función se ejecuta automáticamente por el onSnapshot en el useEffect
  };

  // Modal para goleador
  const [showGoleadorModal, setShowGoleadorModal] = useState(false);
  const [goleadorNombre, setGoleadorNombre] = useState("");
  const [golMatchId, setGolMatchId] = useState(null);
  const [golEquipo, setGolEquipo] = useState(null);

  // Modal para ver y editar goleadores
  const [showListaGoleadores, setShowListaGoleadores] = useState(false);
  const [editGoleadoresA, setEditGoleadoresA] = useState([]);
  const [editGoleadoresB, setEditGoleadoresB] = useState([]);
  const [editMatchId, setEditMatchId] = useState(null);

  // Para standings y auto-creación de partidos
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});

  // Obtener grupos desde Firestore
  useEffect(() => {
    const obtenerGrupos = async () => {
      try {
        const q = query(
          collection(db, "grupos"),
          where("disciplina", "==", discipline)
        );
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar grupos en el cliente según los filtros activos
        let gruposFiltrados = data;
        
        if (filtroGenero) {
          gruposFiltrados = gruposFiltrados.filter(grupo => grupo.genero === filtroGenero);
        }
        
        if (filtroCategoria) {
          gruposFiltrados = gruposFiltrados.filter(grupo => grupo.categoria === filtroCategoria);
        }
        
        setGrupos(gruposFiltrados);
      } catch (error) {
        console.error("Error al obtener grupos:", error);
        setError("Error al cargar grupos");
        setGrupos([]); // En caso de error, establecer array vacío
      }
    };
    obtenerGrupos();
  }, [discipline, filtroGenero, filtroNivelEducacional, filtroCategoria]);

  // Obtener categorías desde Firestore
  useEffect(() => {
    const obtenerCategorias = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "categorias"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategorias(data);
      } catch (error) {
        console.error("Error al obtener categorías:", error);
        setError("Error al cargar categorías");
        setCategorias([]);
      } finally {
        setLoading(false);
      }
    };
    obtenerCategorias();
  }, [discipline]);

  // Obtener niveles educacionales desde Firestore
  useEffect(() => {
    const obtenerNivelesEducacionales = async () => {
      try {
        const q = query(
          collection(db, "nivelesEducacionales"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setNivelesEducacionales(data);
      } catch (error) {
        console.error("Error al obtener niveles educacionales:", error);
        setError("Error al cargar niveles educacionales");
        setNivelesEducacionales([]);
      }
    };
    obtenerNivelesEducacionales();
  }, [discipline]);

  // Obtener equipos desde Firestore
  useEffect(() => {
    const obtenerEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline),
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          curso: doc.data().curso,
          paralelo: doc.data().paralelo,
          grupo: doc.data().grupo,
          categoria: doc.data().categoria,
          genero: doc.data().genero,
        }));
        setEquipos(data);
      } catch (error) {
        console.error("Error al obtener equipos:", error);
        setEquipos([]);
      }
    };
    obtenerEquipos();
  }, [discipline]);

  // Obtener partidos en tiempo real
  useEffect(() => {
    try {
      const q = query(
        collection(db, "matches"),
        where("disciplina", "==", discipline),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        console.log(`📊 onSnapshot: ${data.length} partidos recibidos`);
        
        // Actualizar la referencia y el estado
        matchesRef.current = data;
        setMatches(data);
      }, (error) => {
        console.error("Error al obtener partidos:", error);
        setMatches([]);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Error al configurar listener de partidos:", error);
      setMatches([]);
    }
  }, [discipline]);

  // Auto-generación de siguientes fases cuando se completa una fase (DESHABILITADO - ahora se ejecuta al finalizar partidos)
  /*
  useEffect(() => {
    if (!filtroGenero || !filtroCategoria || matches.length === 0 || equipos.length === 0) return;

    const verificarYGenerarFasesFinales = async () => {
      // Esta funcionalidad ahora se ejecuta automáticamente cuando se finaliza un partido
      // Ver: verificarYGenerarFasesFinalesPostPartido()
    };

    // verificarYGenerarFasesFinales(); // Comentado para evitar ejecución automática continua
  }, [matches, equipos, filtroGenero, filtroNivelEducacional, filtroCategoria]);
  */

  // Calcular standings por grupo
  useEffect(() => {
    const equiposPorGrupo = {};
    equipos.forEach((equipo) => {
      const grupo = equipo.grupo || "Sin grupo";
      if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
      equiposPorGrupo[grupo].push(equipo);
    });

    const standingsPorGrupoTemp = {};
    Object.entries(equiposPorGrupo).forEach(([grupo, equiposGrupo]) => {
      const table = {};
      matches
        .filter(
          (match) =>
            match.estado === "finalizado" &&
            equiposGrupo.some(
              (eq) =>
                `${eq.curso} ${eq.paralelo}` ===
                  `${match.equipoA.curso} ${match.equipoA.paralelo}` ||
                `${eq.curso} ${eq.paralelo}` ===
                  `${match.equipoB.curso} ${match.equipoB.paralelo}`,
            ),
        )
        .forEach((match) => {
          const { equipoA, equipoB, marcadorA, marcadorB } = match;
          if (marcadorA === null || marcadorB === null) return;
          const keyA = `${equipoA.curso} ${equipoA.paralelo}`;
          const keyB = `${equipoB.curso} ${equipoB.paralelo}`;
          if (!table[keyA]) table[keyA] = createTeamEntry(keyA, grupo);
          if (!table[keyB]) table[keyB] = createTeamEntry(keyB, grupo);
          table[keyA].pj++;
          table[keyB].pj++;
          table[keyA].gf += marcadorA;
          table[keyA].gc += marcadorB;
          table[keyB].gf += marcadorB;
          table[keyB].gc += marcadorA;
          if (marcadorA > marcadorB) {
            table[keyA].pts += 3;
            table[keyA].pg++;
            table[keyB].pp++;
          } else if (marcadorA < marcadorB) {
            table[keyB].pts += 3;
            table[keyB].pg++;
            table[keyA].pp++;
          } else {
            table[keyA].pts += 1;
            table[keyB].pts += 1;
            table[keyA].pe++;
            table[keyB].pe++;
          }
        });
      equiposGrupo.forEach((equipo) => {
        const nombre = `${equipo.curso} ${equipo.paralelo}`;
        if (!table[nombre]) {
          table[nombre] = createTeamEntry(nombre, grupo);
        }
      });
      const result = Object.values(table)
        .map((team) => ({
          ...team,
          dg: team.gf - team.gc,
        }))
        .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
      standingsPorGrupoTemp[grupo] = result;
    });
    setStandingsPorGrupo(standingsPorGrupoTemp);
  }, [matches, equipos]);

  // Limpiar filtros de grupo automáticamente para fases finales
  useEffect(() => {
    let faseActualNombre = null;
    if (Array.isArray(fasesArray) && fasesArray.length > 0 && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fasesArray.length) {
      faseActualNombre = fasesArray[faseActual];
    }
    if (faseActualNombre === "semifinales" || faseActualNombre === "final" || faseActualNombre === "tercerPuesto") {
      if (filtroGrupos.length > 0) {
        setFiltroGrupos([]);
        console.log(`DEBUG: Filtros de grupo limpiados automáticamente para fase "${faseActualNombre}"`);
      }
    }
  }, [faseActual, fasesArray, filtroGrupos.length]);

  function createTeamEntry(nombre, grupo) {
    import React, { useEffect, useState, useRef } from "react";
    import { db } from "../firebase/config";
    import {
      collection,
      getDocs,
      addDoc,
      updateDoc,
      deleteDoc,
      doc,
      query,
      where,
      onSnapshot,
    } from "firebase/firestore";
    import { useParams } from "react-router-dom";
    import "../styles/AdminMatches.css";
    import { useNavigate } from "react-router-dom";
    import Modal from "../components/Modal";
    import { useToast } from "../components/Toast";

    export default function AdminMatches() {
      // ...restaurar toda la lógica y JSX del backup2...
    }

    // Exportar función para uso externo desde AdminMatchDetail.jsx
    export const verificarYGenerarFasesFinalesExterna = async (partidoFinalizadoId, estadoMatches, showToast) => {
      // ...restaurar toda la lógica de la función del backup2...
    };
    // Encapsular el botón y los divs correctamente
    // return el JSX correcto aquí
    // Por ejemplo:
    // return (
    //   <div>Contenido del equipo</div>
    // );
  }

      {/* Formulario de creación de partidos */}
      <div className="create-match-section">
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Programar Nuevo Partido
        </h2>

        <div className="create-match-form">
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏠</span>
                Equipo Local
              </label>
              <select
                value={newMatch.equipoA}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoA: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo local</option>
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">✈️</span>
                Equipo Visitante
              </label>
              <select
                value={newMatch.equipoB}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoB: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo visitante</option>
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📅</span>
                Fecha
              </label>
              <input
                type="date"
                value={newMatch.fecha}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, fecha: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">⏰</span>
                Hora
              </label>
              <input
                type="time"
                value={newMatch.hora}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, hora: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <button onClick={handleAddMatch} className="create-match-btn">
              <span className="btn-icon">🎯</span>
              <span>Programar Partido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegador de fases */}
      <div className="phase-navigation">
        <div className="phase-controls">
          <button
            onClick={() => {
              const nuevaFase = Math.max(0, faseActual - 1);
              setFaseActual(nuevaFase);
              // Limpiar filtros de grupo para fases finales
              const faseSeleccionada = fasesArray && fasesArray[nuevaFase] ? fasesArray[nuevaFase] : "grupos";
              if (faseSeleccionada === "final" || faseSeleccionada === "tercerPuesto") {
                setFiltroGrupos([]);
                console.log(`DEBUG: Filtros de grupo limpiados para fase "${faseSeleccionada}"`);
              }
            }}
            disabled={faseActual === 0}
            className={`phase-btn prev-btn ${faseActual === 0 ? "disabled" : ""}`}
          >
            <span className="btn-icon">←</span>
          </button>

          <div className="current-phase">
            <span className="phase-icon">
              {Array.isArray(fasesArray) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fasesArray.length
                ? obtenerIconoFase(fasesArray[faseActual])
                : obtenerIconoFase("grupos")}
            </span>
            <h2 className="phase-title">
              {Array.isArray(fases) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fases.length
                ? fases[faseActual]
                : "Fase"}
            </h2>
            {/* Indicador de fase completa */}
            {(() => {
              const faseSeleccionadaCompleta = Array.isArray(fasesArray) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fasesArray.length
                ? fasesArray[faseActual]
                : "grupos";
              return verificarFaseCompleta(faseSeleccionadaCompleta) && faseSeleccionadaCompleta !== "finales" && (
                <div style={{ 
                  background: "#10b981", 
                  color: "white", 
                  padding: "0.25rem 0.75rem", 
                  borderRadius: "12px", 
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                  display: "inline-block"
                }}>
                  ✅ Fase completada - Siguiente fase generada automáticamente
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => {
              const nuevaFase = Math.min(fases.length - 1, faseActual + 1);
              setFaseActual(nuevaFase);
              // Limpiar filtros de grupo para fases finales
              const faseSeleccionada = fasesArray && fasesArray[nuevaFase] ? fasesArray[nuevaFase] : "grupos";
              if (faseSeleccionada === "final" || faseSeleccionada === "tercerPuesto") {
                setFiltroGrupos([]);
                console.log(`DEBUG: Filtros de grupo limpiados para fase "${faseSeleccionada}"`);
              }
            }}
            disabled={faseActual === fases.length - 1}
            className={`phase-btn next-btn ${faseActual === fases.length - 1 ? "disabled" : ""}`}
          >
            <span className="btn-icon">→</span>
          </button>
        </div>
      </div>

      {/* Mostrar solo la tabla de la fase actual */}
      <div className="matches-table-section">
        {(() => {
          // Validar que faseActual esté en el rango válido
          const faseSeleccionada = fasesArray && fasesArray[faseActual] ? fasesArray[faseActual] : "grupos";
          const stats = getFilterStats(faseSeleccionada);
          return (
            <>
              {stats.hidden > 0 && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffeaa7',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#856404'
                  }}>
                    <span style={{
                      backgroundColor: '#f39c12',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {stats.hidden}
                    </span>
                    <span>
                      {stats.hidden} partido{stats.hidden > 1 ? 's' : ''} oculto{stats.hidden > 1 ? 's' : ''} por filtros
                      ({stats.visible} de {stats.total} visible{stats.visible !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFiltroGenero('');
                      setFiltroCategoria('');
                      setFiltroGrupos([]);
                    }}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Mostrar todos
                  </button>
                </div>
              )}
              {(() => {
                const partidosParaTabla = partidosPorFase(faseSeleccionada);
                console.log(`🎭 Llamando TablaPartidos con fase "${faseSeleccionada}" (faseActual=${faseActual})`);
                console.log(`🎯 Partidos para la tabla:`, partidosParaTabla.length);
                return <TablaPartidos partidos={partidosParaTabla} />;
              })()}
            </>
          );
        })()}
      </div>

      {/* Modal para ingresar nombre del goleador */}
      {showGoleadorModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 300,
            }}
          >
            <h3>¿Quién anotó el gol?</h3>
            <input
              type="text"
              value={goleadorNombre}
              onChange={(e) => setGoleadorNombre(e.target.value)}
              placeholder="Nombre del goleador"
              style={{
                width: "100%",
                padding: "0.5rem",
                margin: "1rem 0",
                fontSize: "1rem",
              }}
              autoFocus
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowGoleadorModal(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!goleadorNombre.trim()) return;
                  await handleGol(golMatchId, golEquipo, goleadorNombre.trim());
                  setShowGoleadorModal(false);
                }}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver y editar goleadores */}
      {showListaGoleadores && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 350,
            }}
          >
            <h3>Goleadores del partido</h3>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresA.length > 0 ? (
                editGoleadoresA.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresA];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresA(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresB.length > 0 ? (
                editGoleadoresB.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresB];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresB(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowListaGoleadores(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoleadoresEdit}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar grupo */}
      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">¿Estás seguro?</h3>
            <p className="modal-text">
              ¿Seguro que quieres eliminar <strong>todos los partidos</strong>{" "}
              del grupo <strong>{grupoAEliminar}</strong>?
              <br />
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="cancel-btn"
              >
                <span className="btn-icon">❌</span>
                Cancelar
              </button>
              <button
                onClick={handleDeleteGroupMatches}
                className="confirm-delete-btn"
              >
                <span className="btn-icon">🗑️</span>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

  // Filtrar partidos por fase y aplicar filtros de género/categoría/grupos
  const partidosPorFase = (fase) => {
    console.log(`DEBUG: Filtrando partidos para fase "${fase}"`);
    console.log(`DEBUG: Total partidos disponibles: ${matches.length}`);
    
    // Validar que fase no sea undefined o null
    if (!fase) {
      console.log(`DEBUG: Fase es undefined/null, retornando array vacío`);
      return [];
    }
    
    const partidosFiltrados = matches.filter((m) => {
      // Normalizar las fases para comparación
      let partidoFase = m.fase || "grupos";
      let faseBuscada = fase;
      
      // Validar que ambas variables sean strings antes de toLowerCase
      if (typeof partidoFase !== 'string') partidoFase = "grupos";
      if (typeof faseBuscada !== 'string') faseBuscada = "grupos";
      
      // Normalizar a minúsculas para comparar
      const faseNormalizada = partidoFase.toLowerCase();
      const faseBuscadaNormalizada = faseBuscada.toLowerCase();
      
      // Mapeo de fases (ampliado para incluir nuevas fases)
      const mapeoFases = {
        'grupos': 'grupos',
        'fase de grupos': 'grupos',
        'ida': 'ida',
        'partidos de ida': 'ida',
        'vuelta': 'vuelta', 
        'partidos de vuelta': 'vuelta',
        'desempate': 'desempate',
        'semifinales': 'semifinales',
        'final': 'final',
        'tercer puesto': 'tercerpuesto',
        'tercerpuesto': 'tercerpuesto'
      };
      
      const fasePartidoNormalizada = mapeoFases[faseNormalizada] || faseNormalizada;
      const faseBuscadaNormalizada2 = mapeoFases[faseBuscadaNormalizada] || faseBuscadaNormalizada;
      
      const faseMatch = fasePartidoNormalizada === faseBuscadaNormalizada2;
      
      console.log(`DEBUG: Comparando fases - Partido: "${partidoFase}" (${fasePartidoNormalizada}) vs Buscada: "${fase}" (${faseBuscadaNormalizada2}) = ${faseMatch}`);
      
      if (!faseMatch) return false;
      
      console.log(`DEBUG: Partido encontrado para fase "${fase}":`, {
        equipoA: `${m.equipoA?.curso} ${m.equipoA?.paralelo}`,
        equipoB: `${m.equipoB?.curso} ${m.equipoB?.paralelo}`,
        fase: m.fase,
        genero: m.equipoA?.genero,
        categoria: m.equipoA?.categoria,
        grupo: m.grupo
      });
      
      // Si no hay filtros seleccionados, mostrar todos los partidos de la fase
      if (!filtroGenero && !filtroNivelEducacional && !filtroCategoria && filtroGrupos.length === 0) {
        return true;
      }
      
      // Aplicar filtros (pero permitir undefined para partidos antiguos)
      const generoMatch = !filtroGenero || (
        (m.equipoA?.genero === filtroGenero || !m.equipoA?.genero) && 
        (m.equipoB?.genero === filtroGenero || !m.equipoB?.genero)
      );
      const nivelEducacionalMatch = !filtroNivelEducacional || (
        m.equipoA?.nivelEducacional === filtroNivelEducacional && 
        m.equipoB?.nivelEducacional === filtroNivelEducacional
      );
      const categoriaMatch = !filtroCategoria || (
        (m.equipoA?.categoria === filtroCategoria || !m.equipoA?.categoria) && 
        (m.equipoB?.categoria === filtroCategoria || !m.equipoB?.categoria)
      );
      const grupoMatch = filtroGrupos.length === 0 || filtroGrupos.includes(m.grupo) || !m.grupo;
      
      const passFilter = generoMatch && nivelEducacionalMatch && categoriaMatch && grupoMatch;
      
      // Debug detallado para cada partido
      if (filtroNivelEducacional) {
        console.log(`DEBUG NIVEL: Evaluando partido ${m.equipoA?.curso} ${m.equipoA?.paralelo} vs ${m.equipoB?.curso} ${m.equipoB?.paralelo}:`, {
          filtroNivelEducacional,
          equipoA_nivel: m.equipoA?.nivelEducacional,
          equipoB_nivel: m.equipoB?.nivelEducacional,
          nivelEducacionalMatch,
          passFilter: generoMatch && nivelEducacionalMatch && categoriaMatch && grupoMatch
        });
      }
      
      if (!passFilter) {
        console.log(`DEBUG: ❌ Partido RECHAZADO por filtros`);
      } else {
        console.log(`DEBUG: ✅ Partido ACEPTADO`);
      }
      
      return passFilter;
    });
    
    console.log(`DEBUG: Partidos filtrados para fase "${fase}": ${partidosFiltrados.length}`);
    return partidosFiltrados;
  };

  // Función para obtener estadísticas de filtrado
  const getFilterStats = (fase) => {
    // Validar que fase no sea undefined o null
    if (!fase) {
      return {
        total: 0,
        mostrados: 0,
        ocultos: 0
      };
    }
    
    const partidosFase = matches.filter(m => {
      // Usar la misma lógica de normalización
      let partidoFase = m.fase || "grupos";
      let faseBuscada = fase;
      
      // Validar que ambas variables sean strings antes de toLowerCase
      if (typeof partidoFase !== 'string') partidoFase = "grupos";
      if (typeof faseBuscada !== 'string') faseBuscada = "grupos";
      
      const faseNormalizada = partidoFase.toLowerCase();
      const faseBuscadaNormalizada = faseBuscada.toLowerCase();
      
      const mapeoFases = {
        'grupos': 'grupos',
        'fase de grupos': 'grupos',
        'semifinales': 'semifinales',
        'final': 'final',
        'tercer puesto': 'tercerpuesto',
        'tercerpuesto': 'tercerpuesto'
      };
      
      const fasePartidoNormalizada = mapeoFases[faseNormalizada] || faseNormalizada;
      const faseBuscadaNormalizada2 = mapeoFases[faseBuscadaNormalizada] || faseBuscadaNormalizada;
      
      return fasePartidoNormalizada === faseBuscadaNormalizada2;
    });
    
    const partidosFiltrados = partidosPorFase(fase);
    const partidosOcultos = partidosFase.length - partidosFiltrados.length;
    
    return {
      total: partidosFase.length,
      visible: partidosFiltrados.length,
      hidden: partidosOcultos
    };
  };

  // Abrir modal de goleadores para editar
  const handleOpenGoleadores = (match) => {
    setEditGoleadoresA([...match.goleadoresA]);
    setEditGoleadoresB([...match.goleadoresB]);
    setEditMatchId(match.id);
    setShowListaGoleadores(true);
  };

  // Guardar edición de goleadores
  const handleSaveGoleadoresEdit = async () => {
    const matchRef = doc(db, "matches", editMatchId);
    await updateDoc(matchRef, {
      goleadoresA: editGoleadoresA,
      goleadoresB: editGoleadoresB,
    });
    setShowListaGoleadores(false);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === editMatchId
          ? { ...m, goleadoresA: editGoleadoresA, goleadoresB: editGoleadoresB }
          : m,
      ),
    );
  };

  // Componente para mostrar la tabla de partidos de una fase
  function TablaPartidos({ partidos }) {
    console.log(`🎪 TablaPartidos recibió ${partidos.length} partidos:`, partidos.map(p => ({
      equipoA: `${p.equipoA?.curso} ${p.equipoA?.paralelo}`,
      equipoB: `${p.equipoB?.curso} ${p.equipoB?.paralelo}`,
      grupo: p.grupo,
      fase: p.fase
    })));
    
    // Agrupa partidos por grupo para cualquier fase
    const partidosPorGrupo = agruparPorGrupo(partidos);
    
    console.log(`🏟️ Partidos agrupados por grupo:`, partidosPorGrupo);
    
    // Para fases finales (semifinales, final, tercer puesto), mostrar todos los grupos que tengan partidos
    // Para fase de grupos, usar solo los grupos filtrados
    let gruposAMostrar;
    
    // Validar que faseActual esté en el rango válido
    const faseActualSeleccionada = fasesArray && fasesArray[faseActual] ? fasesArray[faseActual] : "grupos";
    
    if (faseActualSeleccionada === "grupos") {
      // Filtrar grupos únicos para evitar duplicados (solo para fase de grupos)
      gruposAMostrar = grupos.filter((grupo, index, self) => 
        index === self.findIndex(g => g.nombre === grupo.nombre)
      );
    } else {
      // Para fases finales, crear grupos dinámicos basados en los partidos que existen
      gruposAMostrar = Object.keys(partidosPorGrupo).map(nombreGrupo => ({
        id: `dynamic-${nombreGrupo}`,
        nombre: nombreGrupo
      }));
    }
    
    console.log(`👥 Grupos a mostrar (fase: ${faseActualSeleccionada}):`, gruposAMostrar.map(g => g.nombre));
    console.log(`📋 Grupos con partidos:`, Object.keys(partidosPorGrupo));
    
    return (
      <>
        {gruposAMostrar.map((grupoObj, index) => {
          const nombreGrupo = grupoObj.nombre;
          const partidosDelGrupo = partidosPorGrupo[nombreGrupo];
          
          return partidosDelGrupo && partidosDelGrupo.length > 0 ? (
            <div key={`${grupoObj.id}-${index}-${nombreGrupo}`} className="match-group">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "1.5rem 0 0.5rem",
                }}
              >
                <h3 style={{ margin: 0 }}>{nombreGrupo}</h3>
                {/* Botón eliminar solo para fase de grupos */}
                {faseActualSeleccionada === "grupos" && (
                  <button
                    style={{
                      marginLeft: 16,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "0.2rem 0.7rem",
                      cursor: "pointer",
                      fontSize: "0.9em",
                    }}
                    onClick={() => {
                      setGrupoAEliminar(nombreGrupo);
                      setShowConfirmDelete(true);
                    }}
                  >
                    Eliminar todos los partidos
                  </button>
                )}
              </div>

              <table className="admin-matches-table">
                <thead>
                  <tr>
                    <th>Equipo A</th>
                    <th>Equipo B</th>
                    <th>Marcador</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {partidosPorGrupo[nombreGrupo].map((match) => (
                    <tr
                      key={match.id}
                      onClick={() => irADetallePartido(match.id)}
                      style={{ cursor: "pointer" }}
                      className="admin-clickable-row"
                    >
                      <td>
                        {match.equipoA?.curso} {match.equipoA?.paralelo}
                      </td>
                      <td>
                        {match.equipoB?.curso} {match.equipoB?.paralelo}
                      </td>
                      <td>
                        {match.marcadorA ?? 0} - {match.marcadorB ?? 0}
                      </td>
                      <td>
                        {match.estado === "finalizado" ? (
                          <span style={{ color: "green", fontWeight: "bold" }}>
                            ✅ Finalizado
                          </span>
                        ) : match.estado === "en curso" ? (
                          <span
                            style={{ color: "#2563eb", fontWeight: "bold" }}
                          >
                            🟢 En curso
                          </span>
                        ) : (
                          <span style={{ color: "orange", fontWeight: "bold" }}>
                            ⏳ Pendiente
                          </span>
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <input
                            type="date"
                            value={editedMatch.fecha}
                            onChange={(e) =>
                              setEditedMatch({
                                ...editedMatch,
                                fecha: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          match.fecha || "Por definir"
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <input
                            type="time"
                            value={editedMatch.hora}
                            onChange={(e) =>
                              setEditedMatch({
                                ...editedMatch,
                                hora: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          match.hora || "Por definir"
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(match.id);
                              }}
                              style={{
                                background: "#22c55e",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMatchId(null);
                              }}
                              style={{
                                background: "#64748b",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(match);
                              }}
                              style={{
                                background: "#3b82f6",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                            >
                              Editar Fecha/Hora
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(match.id);
                              }}
                              style={{
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null;
        })}
      </>
    );

  // Función para actualizar equipos existentes con nivel educacional correcto
  const actualizarEquiposConNivelEducacional = async () => {
    try {
      console.log("🔄 Iniciando actualización de equipos con nivel educacional...");
      showToast("Actualizando equipos con nivel educacional correcto...", "info");
      
      // Obtener todos los equipos de esta disciplina
      const equiposSnapshot = await getDocs(
        query(collection(db, "teams"), where("disciplina", "==", discipline))
      );
      
      // Obtener todos los jugadores de esta disciplina
      const jugadoresSnapshot = await getDocs(
        query(collection(db, "jugadores"), where("disciplina", "==", discipline))
      );
      
      const jugadores = jugadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("📊 Total jugadores encontrados:", jugadores.length);
      
      let equiposActualizados = 0;
      
      for (const equipoDoc of equiposSnapshot.docs) {
        const equipo = { id: equipoDoc.id, ...equipoDoc.data() };
        console.log(`🔍 Procesando equipo: ${equipo.curso} ${equipo.paralelo} - ${equipo.categoria} - ${equipo.genero}`);
        console.log(`   Nivel actual: ${equipo.nivelEducacional}`);
        
        // Buscar jugadores de este equipo específico
        const jugadoresDelEquipo = jugadores.filter(jugador => 
          jugador.curso === equipo.curso &&
          jugador.paralelo === equipo.paralelo &&
          jugador.categoria === equipo.categoria &&
          jugador.genero === equipo.genero
        );
        
        console.log(`   Jugadores encontrados: ${jugadoresDelEquipo.length}`);
        
        if (jugadoresDelEquipo.length > 0) {
          // Tomar el nivel educacional del primer jugador válido
          const nivelEducacionalCorrecto = jugadoresDelEquipo[0].nivelEducacional;
          console.log(`   Nivel del jugador: ${nivelEducacionalCorrecto}`);
          
          if (nivelEducacionalCorrecto && nivelEducacionalCorrecto !== "Sin definir" && nivelEducacionalCorrecto !== equipo.nivelEducacional) {
            // Actualizar el equipo con el nivel educacional correcto
            await updateDoc(doc(db, "teams", equipo.id), {
              nivelEducacional: nivelEducacionalCorrecto
            });
            
            console.log(`✅ Equipo ${equipo.curso} ${equipo.paralelo} actualizado con nivel: ${nivelEducacionalCorrecto}`);
            equiposActualizados++;
          } else {
            console.log(`   No necesita actualización`);
          }
        } else {
          console.log(`   ❌ No se encontraron jugadores para este equipo`);
        }
      }
      
      if (equiposActualizados > 0) {
        showToast(`Se actualizaron ${equiposActualizados} equipos con su nivel educacional correcto`, "success");
        // Recargar datos
        await obtenerEquiposFiltrados();
      } else {
        showToast("No se encontraron equipos para actualizar", "warning");
      }
      
    } catch (error) {
      console.error("❌ Error al actualizar equipos con nivel educacional:", error);
      showToast("Error al actualizar equipos", "error");
    }
  };

  // Función para actualizar partidos existentes con nivel educacional correcto
  const actualizarPartidosConNivelEducacionalDeEquipos = async () => {
    try {
      console.log("🔄 Iniciando actualización de partidos con nivel educacional correcto...");
      showToast("Actualizando partidos con nivel educacional correcto...", "info");
      
      // Obtener todos los partidos de esta disciplina
      const partidosSnapshot = await getDocs(
        query(collection(db, "matches"), where("disciplina", "==", discipline))
      );
      
      // Obtener todos los jugadores para poder asignar nivel educacional
      const jugadoresSnapshot = await getDocs(
        query(collection(db, "jugadores"), where("disciplina", "==", discipline))
      );
      
      const jugadores = jugadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let partidosActualizados = 0;
      
      for (const partidoDoc of partidosSnapshot.docs) {
        const partido = { id: partidoDoc.id, ...partidoDoc.data() };
        let necesitaActualizar = false;
        let datosActualizacion = {};
        
        console.log(`🔍 Procesando partido: ${partido.equipoA?.curso} ${partido.equipoA?.paralelo} vs ${partido.equipoB?.curso} ${partido.equipoB?.paralelo}`);
        
        // Verificar y corregir equipo A
        if (!partido.equipoA?.nivelEducacional || partido.equipoA?.nivelEducacional === "Sin definir") {
          if (partido.equipoA?.curso && partido.equipoA?.paralelo) {
            const jugadoresEquipoA = jugadores.filter(jugador => 
              jugador.curso === partido.equipoA.curso &&
              jugador.paralelo === partido.equipoA.paralelo &&
              jugador.categoria === partido.equipoA.categoria &&
              jugador.genero === partido.equipoA.genero
            );
            
            if (jugadoresEquipoA.length > 0) {
              const nivelEducacionalA = jugadoresEquipoA[0].nivelEducacional;
              if (nivelEducacionalA && nivelEducacionalA !== "Sin definir") {
                datosActualizacion["equipoA.nivelEducacional"] = nivelEducacionalA;
                necesitaActualizar = true;
                console.log(`   ✅ Equipo A actualizado con nivel: ${nivelEducacionalA}`);
              }
            }
          }
        }
        
        // Verificar y corregir equipo B
        if (!partido.equipoB?.nivelEducacional || partido.equipoB?.nivelEducacional === "Sin definir") {
          if (partido.equipoB?.curso && partido.equipoB?.paralelo) {
            const jugadoresEquipoB = jugadores.filter(jugador => 
              jugador.curso === partido.equipoB.curso &&
              jugador.paralelo === partido.equipoB.paralelo &&
              jugador.categoria === partido.equipoB.categoria &&
              jugador.genero === partido.equipoB.genero
            );
            
            if (jugadoresEquipoB.length > 0) {
              const nivelEducacionalB = jugadoresEquipoB[0].nivelEducacional;
              if (nivelEducacionalB && nivelEducacionalB !== "Sin definir") {
                datosActualizacion["equipoB.nivelEducacional"] = nivelEducacionalB;
                necesitaActualizar = true;
                console.log(`   ✅ Equipo B actualizado con nivel: ${nivelEducacionalB}`);
              }
            }
          }
        }
        
        // Actualizar el partido si es necesario
        if (necesitaActualizar) {
          await updateDoc(doc(db, "matches", partido.id), datosActualizacion);
          partidosActualizados++;
          console.log(`✅ Partido actualizado exitosamente`);
        }
      }
      
      if (partidosActualizados > 0) {
        showToast(`Se actualizaron ${partidosActualizados} partidos con nivel educacional correcto`, "success");
        // Recargar datos
        await obtenerEquiposFiltrados();
      } else {
        showToast("No se encontraron partidos para actualizar", "warning");
      }
      
    } catch (error) {
      console.error("❌ Error al actualizar partidos con nivel educacional:", error);
      showToast("Error al actualizar partidos", "error");
    }
  };

  // Función combinada para corregir todos los niveles educacionales
  const corregirTodosLosNivelesEducacionales = async () => {
    try {
      console.log("🚀 Iniciando corrección completa de niveles educacionales...");
      showToast("Corrigiendo niveles educacionales en equipos y partidos...", "info");
      
      // Primero, corregir equipos
      await actualizarEquiposConNivelEducacional();
      
      // Luego, corregir partidos
      await actualizarPartidosConNivelEducacionalDeEquipos();
      
      showToast("Corrección completa finalizada", "success");
      
    } catch (error) {
      console.error("❌ Error en corrección completa:", error);
      showToast("Error en la corrección completa", "error");
    }
  };
  // ...existing code...
  // All hooks, state, and functions above
  // Place the return statement at the end of the function
  return (
    <div className="admin-matches-container">
      {/* Mostrar estado de carga */}
      {loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          fontSize: '1.2rem',
          color: '#666'
        }}>
          <div>
            <div style={{textAlign: 'center', marginBottom: '1rem'}}>⏳</div>
            Cargando datos...
          </div>
        </div>
      )}

      {/* Mostrar error si existe */}
      {error && !loading && (
        <div style={{
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem',
          color: '#c33'
        }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginLeft: '1rem',
              padding: '0.5rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Recargar página
          </button>
        </div>
      )}

      {/* Contenido principal - solo mostrar si no hay carga ni error */}
      {!loading && !error && (
        <>
          {/* Header moderno */}
          <div className="admin-header">
            <div className="header-icon">
              {discipline === "futbol"
                ? "⚽"
                : discipline === "voley"
                  ? "🏐"
                  : "🏀"}
            </div>
        <h1 className="admin-title">Gestión de Partidos</h1>
        <p className="admin-subtitle">
          Administra los encuentros de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Navegación */}
      <div className="navigation-section">
        <button onClick={goToPanel} className="nav-card panel-card">
          <div className="nav-card-icon">🏠</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Volver al Panel</h3>
            <p className="nav-card-description">Ir al panel principal</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToTeams} className="nav-card teams-card">
          <div className="nav-card-icon">👥</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Equipos</h3>
            <p className="nav-card-description">Administrar equipos participantes</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToStandings} className="nav-card standings-card">
          <div className="nav-card-icon">🏆</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Ver Posiciones</h3>
            <p className="nav-card-description">Consultar tabla de posiciones</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToSchedule} className="nav-card schedule-card">
          <div className="nav-card-icon">📅</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Horarios</h3>
            <p className="nav-card-description">Programar partidos por días</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
      </div>

      {/* Filtros por Género y Categoría */}
      <div className="filters-section" style={{
        background: 'white', 
        borderRadius: '20px', 
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)', 
        padding: '1.5rem', 
        marginBottom: '2rem'
      }}>
        <h3 style={{margin: '0 0 1rem 0', color: '#495057', fontSize: '1.1rem'}}>
          🔍 Filtrar Partidos
        </h3>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🚻</span>
              Género:
            </label>
            <select
              value={filtroGenero}
              onChange={e => handleFiltroGeneroChange(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                minWidth: '140px'
              }}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>📚</span>
              Nivel Educacional:
            </label>
            <select
              value={filtroNivelEducacional}
              onChange={e => handleFiltroNivelEducacionalChange(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                minWidth: '160px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">Todos los niveles</option>
              {nivelesEducacionales
                .filter((nivel, index, self) => 
                  index === self.findIndex(n => n.nombre === nivel.nombre)
                )
                .map((nivel) => (
                  <option key={nivel.id} value={nivel.nombre}>
                    {nivel.nombre}
                  </option>
                ))}
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🏷️</span>
              Categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => {
                handleFiltroCategoriaChange(e.target.value);
              }}
              disabled={!filtroGenero || !filtroNivelEducacional}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                minWidth: '200px',
                backgroundColor: (!filtroGenero || !filtroNivelEducacional) ? '#f5f5f5' : '',
                color: (!filtroGenero || !filtroNivelEducacional) ? '#999' : '',
                cursor: (!filtroGenero || !filtroNivelEducacional) ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todas las categorías</option>
              {categorias
                .filter(cat => 
                  (!filtroGenero || cat.genero === filtroGenero) &&
                  (!filtroNivelEducacional || cat.nivelEducacional === filtroNivelEducacional)
                )
                .map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap'}}>
            <label style={{fontWeight: '500', color: '#666', marginTop: '0.5rem'}}>
              <span style={{marginRight: '0.5rem'}}>👥</span>
              Grupos:
            </label>
            <div style={{
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              minWidth: '200px',
              maxWidth: '600px'
            }}>
              {/* Selector múltiple tipo dropdown mejorado */}
              <div style={{
                border: '1px solid #ced4da',
                borderRadius: '6px',
                backgroundColor: (!filtroGenero || !filtroNivelEducacional || !filtroCategoria) ? '#f5f5f5' : 'white',
                minHeight: '38px',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '0.5rem'
              }}>
                {(!filtroGenero || !filtroNivelEducacional || !filtroCategoria) ? (
                  <div style={{
                    color: '#6c757d',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    padding: '0.25rem'
                  }}>
                    Selecciona género, nivel educacional y categoría primero
                  </div>
                ) : grupos.filter(grupo => {
                  if (filtroGenero && grupo.genero !== filtroGenero) return false;
                  if (filtroNivelEducacional && grupo.nivelEducacional !== filtroNivelEducacional) return false;
                  if (filtroCategoria && grupo.categoria !== filtroCategoria) return false;
                  return true;
                }).length === 0 ? (
                  <div style={{
                    color: '#6c757d',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    padding: '0.25rem'
                  }}>
                    No hay grupos disponibles
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.5rem'
                  }}>
                    {grupos
                      .filter(grupo => {
                        if (filtroGenero && grupo.genero !== filtroGenero) return false;
                        if (filtroNivelEducacional && grupo.nivelEducacional !== filtroNivelEducacional) return false;
                        if (filtroCategoria && grupo.categoria !== filtroCategoria) return false;
                        return true;
                      })
                      .map(grupo => (
                        <label key={grupo.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: filtroGrupos.includes(grupo.nombre) ? '#007bff' : '#f8f9fa',
                          color: filtroGrupos.includes(grupo.nombre) ? 'white' : '#495057',
                          padding: '0.375rem 0.5rem',
                          borderRadius: '6px',
                          border: filtroGrupos.includes(grupo.nombre) ? '1px solid #007bff' : '1px solid #dee2e6',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: filtroGrupos.includes(grupo.nombre) ? '500' : '400',
                          transition: 'all 0.2s ease',
                          minWidth: '100px'
                        }}>
                          <input
                            type="checkbox"
                            checked={filtroGrupos.includes(grupo.nombre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleFiltroGruposChange([...filtroGrupos, grupo.nombre]);
                              } else {
                                handleFiltroGruposChange(filtroGrupos.filter(g => g !== grupo.nombre));
                              }
                            }}
                            style={{
                              marginRight: '0.5rem',
                              transform: 'scale(1.1)',
                              accentColor: '#007bff'
                            }}
                          />
                          <span style={{flex: 1}}>{grupo.nombre}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
              
              {/* Indicador de grupos seleccionados y botón limpiar */}
              {filtroGrupos.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: '#495057',
                    fontWeight: '500'
                  }}>
                    {filtroGrupos.length} grupo{filtroGrupos.length > 1 ? 's' : ''} seleccionado{filtroGrupos.length > 1 ? 's' : ''}:
                  </span>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.25rem'
                  }}>
                    {filtroGrupos.map(grupo => (
                      <span key={grupo} style={{
                        backgroundColor: '#e3f2fd',
                        color: '#1565c0',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {grupo}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleFiltroGruposChange([])}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                    title="Limpiar selección de grupos"
                  >
                    ✕ Limpiar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Alerta de filtros en fases finales */}
          {(faseActual === 'Final' || faseActual === 'Tercer Puesto') && 
           (filtroGrupos.length > 0 || filtroGenero || filtroCategoria) && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                backgroundColor: '#f39c12',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}>
                ⚠
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: '#856404',
                  fontWeight: '600',
                  marginBottom: '0.25rem'
                }}>
                  Filtros activos en fase final
                </div>
                <div style={{
                  color: '#856404',
                  fontSize: '0.9rem'
                }}>
                  Los filtros de grupos pueden ocultar partidos de la fase final. 
                  Se recomienda limpiar todos los filtros para ver todos los partidos.
                </div>
              </div>
              <button
                onClick={() => {
                  setFiltroGenero('');
                  setFiltroCategoria('');
                  setFiltroGrupos([]);
                }}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
                title="Limpiar todos los filtros"
              >
                🗂️ Limpiar Todo
              </button>
            </div>
          )}

          <button
            onClick={generarPartidosGrupos}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Genera automáticamente todos los partidos de la fase de grupos para la categoría seleccionada"
          >
            ⚽ Generar Partidos de Grupos
          </button>

          <button
            onClick={generarFasesFinales}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#ffc107',
              color: (!filtroGenero || !filtroCategoria) ? 'white' : '#212529',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Regenera semifinales y final (solo usar si es necesario corregir el bracket automático)"
          >
            🔄 Regenerar Fases Finales
          </button>

          <button
            onClick={repararSemifinalesExistentes}
            className="btn-regenerar-fases-finales"
            title="Repara semifinales con campos vacíos (categoria, genero, nivelEducacional)"
          >
            🔧 Reparar Semifinales
          </button>

          <button
            onClick={async () => {
              if (!filtroGenero || !filtroCategoria) {
                showToast("⚠️ Selecciona género y categoría primero", "warning");
                return;
              }

              try {
                console.log(`🏆 Generando final manual para ${filtroCategoria} - ${filtroGenero}`);
                
                // Obtener equipos de la categoría
                const equiposCategoria = equipos.filter(eq => 
                  eq.genero === filtroGenero && eq.categoria === filtroCategoria
                );
                
                if (equiposCategoria.length === 0) {
                  showToast("❌ No hay equipos para esta categoría", "error");
                  return;
                }

                // Agrupar por grupo
                const equiposPorGrupo = {};
                equiposCategoria.forEach(equipo => {
                  const grupo = equipo.grupo;
                  if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
                  equiposPorGrupo[grupo].push(equipo);
                });

                const grupos = Object.keys(equiposPorGrupo);
                
                if (grupos.length === 1) {
                  // Solo un grupo: generar final directa
                  const partidosGrupos = matches.filter(match => 
                    match.equipoA?.genero === filtroGenero &&
                    match.equipoA?.categoria === filtroCategoria &&
                    ((!match.fase || match.fase === "grupos") || match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate") &&
                    !match.tipo
                  );
                  
                  // Obtener cache de jugadores
                  const jugadoresSnapshot = await getDocs(collection(db, "jugadores"));
                  const cacheJugadores = jugadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                  
                  await generarFinalGrupoUnico(grupos[0], equiposPorGrupo[grupos[0]], partidosGrupos, filtroGenero, filtroCategoria, cacheJugadores);
                  showToast("🏆 Final generada exitosamente", "success");
                } else {
                  showToast("⚠️ Usa 'Regenerar Fases Finales' para múltiples grupos", "warning");
                }
                
              } catch (error) {
                console.error("❌ Error al generar final:", error);
                showToast("❌ Error al generar final", "error");
              }
            }}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Genera manualmente la final para un grupo único (3 equipos)"
          >
            🏆 Generar Final Manual
          </button>

          <button
            onClick={async () => {
              console.log("🔧 DEBUG: Verificación manual iniciada");
              console.log("📊 Estado actual de matches:", matches.length);
              console.log("🔍 Filtros activos:", { filtroGenero, filtroNivelEducacional, filtroCategoria });
              
              if (!filtroGenero || !filtroCategoria) {
                showToast("⚠️ Selecciona género y categoría primero", "warning");
                return;
              }
              
              const partidosFinalizados = matches.filter(m => 
                m.estado === "finalizado" && 
                m.equipoA?.genero === filtroGenero && 
                m.equipoA?.categoria === filtroCategoria
              );
              
              console.log(`✅ Partidos finalizados de ${filtroCategoria}-${filtroGenero}:`, partidosFinalizados.length);
              
              if (partidosFinalizados.length > 0) {
                const ultimoPartido = partidosFinalizados[partidosFinalizados.length - 1];
                console.log("🎯 Ejecutando verificación manual con último partido:", ultimoPartido.id);
                await verificarYGenerarFasesFinalesPostPartidoConEstado(ultimoPartido.id, matches);
                showToast("🔧 Verificación manual completada - revisa la consola", "info");
              } else {
                showToast("❌ No hay partidos finalizados para verificar", "warning");
              }
            }}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Botón temporal para debug - ejecuta verificación manual"
          >
            🔧 Debug Verificación
          </button>

          <button
            onClick={actualizarEquiposConNivelEducacional}
            style={{
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              marginLeft: '0.5rem'
            }}
            title="Actualizar equipos existentes con su nivel educacional correcto"
          >
            🔧 Corregir Equipos
          </button>

          <button
            onClick={actualizarPartidosConNivelEducacionalDeEquipos}
            style={{
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              marginLeft: '0.5rem'
            }}
            title="Actualizar partidos existentes con nivel educacional de sus equipos"
          >
            🔧 Corregir Partidos
          </button>

          <button
            onClick={corregirTodosLosNivelesEducacionales}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              marginLeft: '0.5rem'
            }}
            title="Corregir automáticamente todos los niveles educacionales de equipos y partidos"
          >
            🚀 Corregir Todo
          </button>
          
          {(filtroGenero || filtroNivelEducacional || filtroCategoria || filtroGrupos.length > 0) && (
            <button
              onClick={() => {
                setFiltroGenero("");
                setFiltroNivelEducacional("");
                setFiltroCategoria("");
                setFiltroGrupos([]);
                localStorage.removeItem('olimpiadas_filtro_genero');
                localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              title="Limpiar todos los filtros y mostrar todos los partidos"
            >
                {/* Puedes agregar un icono SVG aquí si lo deseas */}
                Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Formulario de creación de partidos */}
      <div className="create-match-section">
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Programar Nuevo Partido
        </h2>

        <div className="create-match-form">
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏠</span>
                Equipo Local
              </label>
              <select
                value={newMatch.equipoA}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoA: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo local</option>
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">✈️</span>
                Equipo Visitante
              </label>
              <select
                value={newMatch.equipoB}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoB: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo visitante</option>
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📅</span>
                Fecha
              </label>
              <input
                type="date"
                value={newMatch.fecha}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, fecha: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">⏰</span>
                Hora
              </label>
              <input
                type="time"
                value={newMatch.hora}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, hora: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <button onClick={handleAddMatch} className="create-match-btn">
              <span className="btn-icon">🎯</span>
              <span>Programar Partido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegador de fases */}
      <div className="phase-navigation">
        <div className="phase-controls">
          <button
            onClick={() => {
              const nuevaFase = Math.max(0, faseActual - 1);
              setFaseActual(nuevaFase);
              // Limpiar filtros de grupo para fases finales
              const faseSeleccionada = fasesArray && fasesArray[nuevaFase] ? fasesArray[nuevaFase] : "grupos";
              if (faseSeleccionada === "final" || faseSeleccionada === "tercerPuesto") {
                setFiltroGrupos([]);
                console.log(`DEBUG: Filtros de grupo limpiados para fase "${faseSeleccionada}"`);
              }
            }}
            disabled={faseActual === 0}
            className={`phase-btn prev-btn ${faseActual === 0 ? "disabled" : ""}`}
          >
            <span className="btn-icon">←</span>
          </button>

          <div className="current-phase">
            <span className="phase-icon">
              {Array.isArray(fasesArray) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fasesArray.length
                ? obtenerIconoFase(fasesArray[faseActual])
                : obtenerIconoFase("grupos")}
            </span>
            <h2 className="phase-title">
              {Array.isArray(fases) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fases.length
                ? fases[faseActual]
                : "Fase"}
            </h2>
            {/* Indicador de fase completa */}
            {(() => {
              const faseSeleccionadaCompleta = Array.isArray(fasesArray) && typeof faseActual === 'number' && faseActual >= 0 && faseActual < fasesArray.length
                ? fasesArray[faseActual]
                : "grupos";
              return verificarFaseCompleta(faseSeleccionadaCompleta) && faseSeleccionadaCompleta !== "finales" && (
                <div style={{ 
                  background: "#10b981", 
                  color: "white", 
                  padding: "0.25rem 0.75rem", 
                  borderRadius: "12px", 
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                  display: "inline-block"
                }}>
                  ✅ Fase completada - Siguiente fase generada automáticamente
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => {
              const nuevaFase = Math.min(fases.length - 1, faseActual + 1);
              setFaseActual(nuevaFase);
              // Limpiar filtros de grupo para fases finales
              const faseSeleccionada = fasesArray && fasesArray[nuevaFase] ? fasesArray[nuevaFase] : "grupos";
              if (faseSeleccionada === "final" || faseSeleccionada === "tercerPuesto") {
                setFiltroGrupos([]);
                console.log(`DEBUG: Filtros de grupo limpiados para fase "${faseSeleccionada}"`);
              }
            }}
            disabled={faseActual === fases.length - 1}
            className={`phase-btn next-btn ${faseActual === fases.length - 1 ? "disabled" : ""}`}
          >
            <span className="btn-icon">→</span>
          </button>
        </div>
      </div>

      {/* Mostrar solo la tabla de la fase actual */}
      <div className="matches-table-section">
        {(() => {
          // Validar que faseActual esté en el rango válido
          const faseSeleccionada = fasesArray && fasesArray[faseActual] ? fasesArray[faseActual] : "grupos";
          const stats = getFilterStats(faseSeleccionada);
          return (
            <>
              {stats.hidden > 0 && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffeaa7',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#856404'
                  }}>
                    <span style={{
                      backgroundColor: '#f39c12',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {stats.hidden}
                    </span>
                    <span>
                      {stats.hidden} partido{stats.hidden > 1 ? 's' : ''} oculto{stats.hidden > 1 ? 's' : ''} por filtros
                      ({stats.visible} de {stats.total} visible{stats.visible !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFiltroGenero('');
                      setFiltroCategoria('');
                      setFiltroGrupos([]);
                    }}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Mostrar todos
                  </button>
                </div>
              )}
              {(() => {
                const partidosParaTabla = partidosPorFase(faseSeleccionada);
                console.log(`🎭 Llamando TablaPartidos con fase "${faseSeleccionada}" (faseActual=${faseActual})`);
                console.log(`🎯 Partidos para la tabla:`, partidosParaTabla.length);
                return <TablaPartidos partidos={partidosParaTabla} />;
              })()}
            </>
          );
        })()}
      </div>

      {/* Modal para ingresar nombre del goleador */}
      {showGoleadorModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 300,
            }}
          >
            <h3>¿Quién anotó el gol?</h3>
            <input
              type="text"
              value={goleadorNombre}
              onChange={(e) => setGoleadorNombre(e.target.value)}
              placeholder="Nombre del goleador"
              style={{
                width: "100%",
                padding: "0.5rem",
                margin: "1rem 0",
                fontSize: "1rem",
              }}
              autoFocus
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowGoleadorModal(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!goleadorNombre.trim()) return;
                  await handleGol(golMatchId, golEquipo, goleadorNombre.trim());
                  setShowGoleadorModal(false);
                }}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver y editar goleadores */}
      {showListaGoleadores && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 350,
            }}
          >
            <h3>Goleadores del partido</h3>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresA.length > 0 ? (
                editGoleadoresA.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresA];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresA(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresB.length > 0 ? (
                editGoleadoresB.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresB];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresB(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowListaGoleadores(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoleadoresEdit}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar grupo */}
      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">¿Estás seguro?</h3>
            <p className="modal-text">
              ¿Seguro que quieres eliminar <strong>todos los partidos</strong>{" "}
              del grupo <strong>{grupoAEliminar}</strong>?
              <br />
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="cancel-btn"
              >
                <span className="btn-icon">❌</span>
                Cancelar
              </button>
              <button
                onClick={handleDeleteGroupMatches}
                className="confirm-delete-btn"
              >
                <span className="btn-icon">🗑️</span>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      
      {/* Modal para confirmaciones */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        title={modalConfig.title}
        body={modalConfig.body}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
      
      {/* Container para notificaciones toast */}
      <ToastContainer />
    </div>
  );

// Exportar función para uso externo desde AdminMatchDetail.jsx
// Mover fuera del componente principal
export async function verificarYGenerarFasesFinalesExterna(partidoFinalizadoId, estadoMatches, showToast) {
  // Esta es una función wrapper que puede ser llamada desde otros componentes
  // Usar las dependencias ya importadas en lugar de imports dinámicos
  
  try {
    console.log(`🔍 INICIANDO verificación externa para partido ID: ${partidoFinalizadoId}`);
    console.log(`📊 Total matches recibidos: ${estadoMatches.length}`);
    
    // Obtener el partido que se acaba de finalizar
    const partidoFinalizado = estadoMatches.find(m => m.id === partidoFinalizadoId);
    if (!partidoFinalizado) {
      console.error(`❌ No se encontró el partido con ID: ${partidoFinalizadoId}`);
      return;
    }

    console.log(`🎯 Partido finalizado encontrado:`, {
      id: partidoFinalizado.id,
      equipoA: partidoFinalizado.equipoA,
      equipoB: partidoFinalizado.equipoB,
      disciplina: partidoFinalizado.disciplina,
      grupo: partidoFinalizado.grupo,
      fase: partidoFinalizado.fase,
      categoria: partidoFinalizado.categoria,
      genero: partidoFinalizado.genero,
      nivelEducacional: partidoFinalizado.nivelEducacional
    });
    
    // Log completo para debugging
    console.log(`🔬 OBJETO COMPLETO partidoFinalizado:`, partidoFinalizado);

    const { disciplina, grupo } = partidoFinalizado;

    // Obtener todos los partidos de la misma disciplina y grupo
    const partidosDelGrupo = estadoMatches.filter(m => 
      m.disciplina === disciplina && m.grupo === grupo && m.fase === "grupos"
    );

    console.log(`📋 Partidos del grupo ${grupo} (disciplina: ${disciplina}):`, partidosDelGrupo.length);

    // Verificar si todos los partidos del grupo están finalizados
    const partidosFinalizados = partidosDelGrupo.filter(m => m.estado === "finalizado");
    const todosFinalizado = partidosFinalizados.length === partidosDelGrupo.length && partidosDelGrupo.length > 0;

    console.log(`✅ Partidos finalizados: ${partidosFinalizados.length}/${partidosDelGrupo.length}`);
    console.log(`🏁 Todos finalizados: ${todosFinalizado}`);

    if (!todosFinalizado) {
      console.log(`⏳ Grupo ${grupo} aún no está completo. Esperando más partidos...`);
      return;
    }

    console.log(`🎯 Grupo ${grupo} completado - Verificando generación de semifinales...`);

    // Obtener todos los grupos de la misma categoría/disciplina
    const todosLosPartidos = estadoMatches.filter(m => m.disciplina === disciplina);
    const gruposUnicos = [...new Set(todosLosPartidos.map(m => m.grupo))];
    
    console.log(`📊 Grupos encontrados en ${disciplina}:`, gruposUnicos);

    if (gruposUnicos.length > 1) {
      console.log(`🏆 Múltiples grupos detectados (${gruposUnicos.length}) - Verificando semifinales cruzadas...`);
      
      // Verificar si ya existen semifinales
      const semifinalesExistentes = estadoMatches.filter(m => 
        m.disciplina === disciplina && m.fase === "semifinales"
      );

      if (semifinalesExistentes.length > 0) {
        console.log(`✅ Semifinales ya existen para ${disciplina}:`, semifinalesExistentes.length);
        return;
      }

      // Verificar si todos los grupos están completos
      let todosGruposCompletos = true;
      for (const grupoNombre of gruposUnicos) {
        const partidosGrupo = estadoMatches.filter(m => 
          m.disciplina === disciplina && m.grupo === grupoNombre && m.fase === "grupos"
        );
        const partidosGrupoFinalizados = partidosGrupo.filter(m => m.estado === "finalizado");
        
        if (partidosGrupoFinalizados.length !== partidosGrupo.length || partidosGrupo.length === 0) {
          todosGruposCompletos = false;
          console.log(`⏳ Grupo ${grupoNombre} no está completo: ${partidosGrupoFinalizados.length}/${partidosGrupo.length}`);
          break;
        }
      }

      if (!todosGruposCompletos) {
        console.log(`⏳ No todos los grupos están completos aún. Esperando...`);
        return;
      }

      console.log(`🚀 Todos los grupos completos - Generando semifinales cruzadas para ${disciplina}...`);
      
      // Generar semifinales cruzadas
      if (showToast) {
        showToast("🏆 Generando semifinales automáticamente...", "success");
      }

      // 🚀 IMPLEMENTAR LÓGICA REAL DE GENERACIÓN DE SEMIFINALES
      try {
        console.log(`📊 Calculando clasificaciones para ${gruposUnicos.length} grupos...`);
        
        // Calcular clasificaciones para cada grupo
        const clasificaciones = {};
        const gruposConEquipos = [];
        
        for (const grupoNombre of gruposUnicos) {
          const partidosGrupo = estadoMatches.filter(m => 
            m.disciplina === disciplina && m.grupo === grupoNombre && m.fase === "grupos"
          );
          
          // Calcular clasificación del grupo
          const equipos = {};
          partidosGrupo.forEach(partido => {
            if (partido.estado === "finalizado") {
              // Inicializar equipos
              if (!equipos[partido.equipoA.curso + partido.equipoA.paralelo]) {
                equipos[partido.equipoA.curso + partido.equipoA.paralelo] = {
                  curso: partido.equipoA.curso,
                  paralelo: partido.equipoA.paralelo,
                  genero: partido.equipoA.genero,
                  categoria: partido.equipoA.categoria,
                  nivelEducacional: partido.equipoA.nivelEducacional,
                  puntos: 0,
                  golesAFavor: 0,
                  golesEnContra: 0,
                  diferenciaGoles: 0,
                  partidos: 0
                };
              }
              if (!equipos[partido.equipoB.curso + partido.equipoB.paralelo]) {
                equipos[partido.equipoB.curso + partido.equipoB.paralelo] = {
                  curso: partido.equipoB.curso,
                  paralelo: partido.equipoB.paralelo,
                  genero: partido.equipoB.genero,
                  categoria: partido.equipoB.categoria,
                  nivelEducacional: partido.equipoB.nivelEducacional,
                  puntos: 0,
                  golesAFavor: 0,
                  golesEnContra: 0,
                  diferenciaGoles: 0,
                  partidos: 0
                };
              }

              const equipoA = equipos[partido.equipoA.curso + partido.equipoA.paralelo];
              const equipoB = equipos[partido.equipoB.curso + partido.equipoB.paralelo];

              equipoA.golesAFavor += partido.golesA || 0;
              equipoA.golesEnContra += partido.golesB || 0;
              equipoB.golesAFavor += partido.golesB || 0;
              equipoB.golesEnContra += partido.golesA || 0;
              equipoA.partidos++;
              equipoB.partidos++;

              // Asignar puntos
              if (partido.golesA > partido.golesB) {
                equipoA.puntos += 3; // Victoria
              } else if (partido.golesA < partido.golesB) {
                equipoB.puntos += 3; // Victoria
              } else {
                equipoA.puntos += 1; // Empate
                equipoB.puntos += 1; // Empate
              }
            }
          });

          // Calcular diferencia de goles
          Object.values(equipos).forEach(equipo => {
            equipo.diferenciaGoles = equipo.golesAFavor - equipo.golesEnContra;
          });

          // Ordenar equipos por puntos, diferencia de goles, goles a favor
          const equiposOrdenados = Object.values(equipos).sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.diferenciaGoles !== a.diferenciaGoles) return b.diferenciaGoles - a.diferenciaGoles;
            return b.golesAFavor - a.golesAFavor;
          });

          console.log(`📋 Clasificación grupo ${grupoNombre}:`, equiposOrdenados);
          clasificaciones[grupoNombre] = equiposOrdenados;
          gruposConEquipos.push(grupoNombre);
        }

        // Verificar que tenemos exactamente 2 grupos con al menos 2 equipos cada uno
        if (gruposConEquipos.length === 2 && 
            clasificaciones[gruposConEquipos[0]].length >= 2 && 
            clasificaciones[gruposConEquipos[1]].length >= 2) {
          
          console.log(`🏆 Generando semifinales cruzadas entre ${gruposConEquipos[0]} y ${gruposConEquipos[1]}...`);
          
          // 🚀 OBTENER DATOS REALES DE LOS EQUIPOS PARTICIPANTES
          const [grupo1, grupo2] = gruposConEquipos;
          const primeroGrupo1 = clasificaciones[grupo1][0];
          const segundoGrupo1 = clasificaciones[grupo1][1];
          const primeroGrupo2 = clasificaciones[grupo2][0];
          const segundoGrupo2 = clasificaciones[grupo2][1];
          
          // Función para obtener datos de un equipo específico
          const obtenerDatosEquipo = async (curso, paralelo, genero) => {
            try {
              console.log(`🔍 Buscando equipo en Firebase: curso="${curso}", paralelo="${paralelo}"`);
              const equiposSnapshot = await getDocs(collection(db, "equipos"));
              console.log(`📦 Total equipos en Firebase: ${equiposSnapshot.docs.length}`);
              
              const todosLosEquipos = equiposSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              console.log(`🔍 Todos los equipos disponibles:`, todosLosEquipos.map(e => `${e.curso} ${e.paralelo} (${e.genero})`));
              
              // 🚀 FILTRAR POR CURSO, PARALELO Y DISCIPLINA
      // Buscar por curso, paralelo y género exacto
      let equiposPosibles = todosLosEquipos.filter(e => 
        e.curso === curso && 
        e.paralelo === paralelo &&
        e.genero === genero // Usar el género del contexto de la semifinal
      );

      // Si hay más de uno, priorizar los que tengan la disciplina
      let equiposConDisciplina = equiposPosibles.filter(e => 
        Array.isArray(e.disciplinas) && e.disciplinas.includes(disciplina)
      );

      if (equiposConDisciplina.length > 0) {
        equiposPosibles = equiposConDisciplina;
      } else if (equiposPosibles.length > 0) {
        console.warn(`⚠️ Equipo encontrado sin disciplina exacta: curso="${curso}", paralelo="${paralelo}", genero="${genero}". Usando el primero disponible.`);
      } else {
        console.error(`❌ No se encontró equipo: curso="${curso}", paralelo="${paralelo}", genero="${genero}"`);
        return null;
      }

      const equipo = equiposPosibles[0];
      if (equipo) {
        console.log(`✅ Equipo seleccionado:`, {
          id: equipo.id,
          curso: equipo.curso,
          paralelo: equipo.paralelo,
          categoria: equipo.categoria,
          genero: equipo.genero,
          nivelEducacional: equipo.nivelEducacional,
          disciplinas: equipo.disciplinas
        });
        return {
          categoria: equipo.categoria,
          genero: equipo.genero,
          nivelEducacional: equipo.nivelEducacional
        };
      } else {
        console.error(`❌ Equipo NO encontrado después del filtro`);
        return null;
      }
            } catch (error) {
              console.error(`❌ Error obteniendo datos de ${curso} ${paralelo}:`, error);
              return null;
            }
          };
          
          // 🚀 SOLUCIÓN CORRECTA: Extraer datos de los equipos que VAN A LAS SEMIFINALES
          console.log(`🎯 Extrayendo datos de los equipos clasificados:`, {
            primeroGrupo1: `${primeroGrupo1.curso} ${primeroGrupo1.paralelo}`,
            segundoGrupo1: `${segundoGrupo1.curso} ${segundoGrupo1.paralelo}`,
            primeroGrupo2: `${primeroGrupo2.curso} ${primeroGrupo2.paralelo}`,
            segundoGrupo2: `${segundoGrupo2.curso} ${segundoGrupo2.paralelo}`
          });
          
          // Obtener datos de los equipos clasificados (no del partido completado)
          const datosEquipo1 = await obtenerDatosEquipo(primeroGrupo1.curso, primeroGrupo1.paralelo, primeroGrupo1.genero);
          const datosEquipo2 = await obtenerDatosEquipo(segundoGrupo1.curso, segundoGrupo1.paralelo, segundoGrupo1.genero);
          const datosEquipo3 = await obtenerDatosEquipo(primeroGrupo2.curso, primeroGrupo2.paralelo, primeroGrupo2.genero);
          const datosEquipo4 = await obtenerDatosEquipo(segundoGrupo2.curso, segundoGrupo2.paralelo, segundoGrupo2.genero);
          
          console.log(`📊 Datos de equipos clasificados:`, {
            equipo1: datosEquipo1,
            equipo2: datosEquipo2,
            equipo3: datosEquipo3,
            equipo4: datosEquipo4
          });
          
          // Filtrar solo los equipos que tienen datos válidos
          const equiposConDatos = [
            { datos: datosEquipo1, equipo: `${primeroGrupo1.curso} ${primeroGrupo1.paralelo}` },
            { datos: datosEquipo2, equipo: `${segundoGrupo1.curso} ${segundoGrupo1.paralelo}` },
            { datos: datosEquipo3, equipo: `${primeroGrupo2.curso} ${primeroGrupo2.paralelo}` },
            { datos: datosEquipo4, equipo: `${segundoGrupo2.curso} ${segundoGrupo2.paralelo}` }
          ].filter(item => item.datos !== null);
          
          if (equiposConDatos.length === 0) {
            console.error(`❌ No se pudieron obtener datos de ningún equipo clasificado`);
            if (showToast) {
              showToast("❌ Error: No se pudieron obtener datos de los equipos clasificados", "error");
            }
            return;
          }
          
          // Verificar consistencia de género entre todos los equipos
          const generos = equiposConDatos.map(item => item.datos.genero);
          const generosUnicos = [...new Set(generos)];
          
          console.log(`🔍 Análisis de consistencia:`, {
            equiposAnalizados: equiposConDatos.map(item => ({ equipo: item.equipo, genero: item.datos.genero })),
            generosUnicos: generosUnicos,
            esConsistente: generosUnicos.length === 1
          });
          
          let categoria, genero, nivelEducacional;
          
          if (generosUnicos.length > 1) {
            console.error(`❌ ERROR: Equipos clasificados tienen géneros diferentes:`, generosUnicos);
            console.error(`❌ Esto indica un problema en la configuración del torneo`);
            if (showToast) {
              showToast(`❌ Error: Equipos clasificados tienen géneros diferentes (${generosUnicos.join(', ')})`, "error");
            }
            return;
          }
          
          // Todos los equipos tienen el mismo género - usar cualquiera
          const datosReferencia = equiposConDatos[0].datos;
          categoria = datosReferencia.categoria;
          genero = datosReferencia.genero;
          nivelEducacional = datosReferencia.nivelEducacional;
          
          console.log(`✅ Datos consistentes para semifinales:`, {
            categoria: categoria,
            genero: genero,
            nivelEducacional: nivelEducacional,
            equiposVerificados: equiposConDatos.length
          });
          
          console.log(`✅ Datos para semifinales confirmados:`, {
            fuente: "partido completado",
            categoria: categoria,
            genero: genero,
            nivelEducacional: nivelEducacional
          });
          
          // Crear semifinales cruzadas: 1°A vs 2°B y 1°B vs 2°A
          const semifinal1 = {
            equipoA: { curso: primeroGrupo1.curso, paralelo: primeroGrupo1.paralelo },
            equipoB: { curso: segundoGrupo2.curso, paralelo: segundoGrupo2.paralelo },
            disciplina: disciplina,
            categoria: categoria,
            genero: genero,
            nivelEducacional: nivelEducacional,
            fase: "semifinales",
            estado: "programado",
            golesA: 0,
            golesB: 0,
            fecha: new Date().toISOString().split('T')[0],
            hora: "Por definir",
            grupo: null, // Las semifinales no tienen grupo específico
            tipo: "eliminacion", // Tipo de torneo
            instancia: "semifinal_1" // Identificador de instancia
          };

          const semifinal2 = {
            equipoA: { curso: primeroGrupo2.curso, paralelo: primeroGrupo2.paralelo },
            equipoB: { curso: segundoGrupo1.curso, paralelo: segundoGrupo1.paralelo },
            disciplina: disciplina,
            categoria: categoria,
            genero: genero,
            nivelEducacional: nivelEducacional,
            fase: "semifinales",
            estado: "programado",
            golesA: 0,
            golesB: 0,
            fecha: new Date().toISOString().split('T')[0],
            hora: "Por definir",
            grupo: null, // Las semifinales no tienen grupo específico
            tipo: "eliminacion", // Tipo de torneo
            instancia: "semifinal_2" // Identificador de instancia
          };

          // Crear los partidos en Firebase
          console.log(`💾 Guardando semifinal 1:`, semifinal1);
          const docRef1 = await addDoc(collection(db, "matches"), semifinal1);
          console.log(`✅ Semifinal 1 guardada con ID: ${docRef1.id}`);
          
          console.log(`💾 Guardando semifinal 2:`, semifinal2);
          const docRef2 = await addDoc(collection(db, "matches"), semifinal2);
          console.log(`✅ Semifinal 2 guardada con ID: ${docRef2.id}`);

          console.log(`🎉 Semifinales cruzadas creadas exitosamente para ${disciplina}`);
          console.log(`📋 Datos completos guardados: categoria="${categoria}", genero="${genero}", nivelEducacional="${nivelEducacional}"`);
          
          // 🚀 SOLUCIÓN INMEDIATA: Actualizar semifinales existentes con campos undefined
          try {
            const semifinalesConCamposVacios = estadoMatches.filter(m => 
              m.fase === "semifinales" && 
              m.disciplina === disciplina &&
              (!m.categoria || !m.genero || !m.nivelEducacional)
            );
            
            if (semifinalesConCamposVacios.length > 0) {
              console.log(`🔧 Actualizando ${semifinalesConCamposVacios.length} semifinales con campos vacíos...`);
              
              for (const semifinal of semifinalesConCamposVacios) {
                await updateDoc(doc(db, "matches", semifinal.id), {
                  categoria: categoria,
                  genero: genero,
                  nivelEducacional: nivelEducacional
                });
                console.log(`✅ Semifinal ${semifinal.id} actualizada`);
              }
            }
          } catch (updateError) {
            console.error(`❌ Error actualizando semifinales existentes:`, updateError);
          }
          
          // 🚀 IMPORTANTE: Forzar actualización de navegación
          console.log(`🔄 Las semifinales deberían aparecer automáticamente en la navegación debido al onSnapshot`);
          console.log(`🎯 Verifica que los filtros actuales incluyan: categoria="${categoria}", genero="${genero}", nivelEducacional="${nivelEducacional}"`);
          
          if (showToast) {
            showToast(`✅ Semifinales CRUZADAS creadas:\n- ${primeroGrupo1.curso} ${primeroGrupo1.paralelo} vs ${segundoGrupo2.curso} ${segundoGrupo2.paralelo}\n- ${primeroGrupo2.curso} ${primeroGrupo2.paralelo} vs ${segundoGrupo1.curso} ${segundoGrupo1.paralelo}\n\n⚠️ Si no aparecen, verifica los filtros de navegación`, "success", 8000);
          }
        } else {
          console.log(`⚠️ No se pueden generar semifinales: ${gruposConEquipos.length} grupos, equipos por grupo: ${gruposConEquipos.map(g => clasificaciones[g]?.length || 0).join(',')}`);
        }
        
      } catch (genError) {
        console.error(`❌ Error al generar semifinales:`, genError);
        if (showToast) {
          showToast("❌ Error al generar semifinales automáticas", "error");
        }
      }
    }
  };

  return (
    <div className="admin-matches">
      <h1>Gestión de Partidos - {discipline}</h1>
      {/* El resto del componente se implementará */}
    </div>
  );
}
  }
