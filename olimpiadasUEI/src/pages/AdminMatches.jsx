import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { useParams } from "react-router-dom";
import "../styles/AdminMatches.css";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

export default function AdminMatches() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // Estados principales
  const [matches, setMatches] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para filtros con persistencia
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_filtro_nivel_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_filtro_categoria_${discipline}`) || "";
  });

  // Estados para opciones de filtros (extraídos dinámicamente de los equipos)
  const [opcionesGenero, setOpcionesGenero] = useState([]);
  const [opcionesNivel, setOpcionesNivel] = useState([]);
  const [opcionesCategorias, setOpcionesCategorias] = useState([]);

  // Estados para edición de partidos y navegación
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editedMatch, setEditedMatch] = useState({ fecha: "", hora: "" });
  const [scoreEdit, setScoreEdit] = useState({});
  const [faseActiva, setFaseActiva] = useState("grupos");

  // Estados para eliminación
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [partidoAEliminar, setPartidoAEliminar] = useState(null);
  const [showConfirmDeleteGroup, setShowConfirmDeleteGroup] = useState(false);
  const [tipoEliminacion, setTipoEliminacion] = useState(""); // "categoria" o "fase"

  // ==================== FUNCIONES DE FILTROS ====================
  
  // Guardar filtros en localStorage
  const guardarFiltros = (genero, nivel, categoria) => {
    localStorage.setItem(`olimpiadas_filtro_genero_${discipline}`, genero);
    localStorage.setItem(`olimpiadas_filtro_nivel_${discipline}`, nivel);
    localStorage.setItem(`olimpiadas_filtro_categoria_${discipline}`, categoria);
  };

  // Manejar cambio de género
  const handleFiltroGeneroChange = (value) => {
    setFiltroGenero(value);
    setFiltroNivelEducacional(""); // Reset dependientes
    setFiltroCategoria("");
    guardarFiltros(value, "", "");
  };

  // Manejar cambio de nivel educacional
  const handleFiltroNivelEducacionalChange = (value) => {
    setFiltroNivelEducacional(value);
    setFiltroCategoria(""); // Reset dependientes
    guardarFiltros(filtroGenero, value, "");
  };

  // Manejar cambio de categoría
  const handleFiltroCategoriaChange = (value) => {
    setFiltroCategoria(value);
    guardarFiltros(filtroGenero, filtroNivelEducacional, value);
  };

  // ==================== FUNCIONES DE CARGA DE DATOS ====================
  
  // Cargar equipos desde Firestore
  useEffect(() => {
    const cargarEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const equiposData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEquipos(equiposData);

        // Extraer opciones únicas para filtros
        const generos = [...new Set(equiposData.map(e => e.genero).filter(Boolean))];
        const niveles = [...new Set(equiposData.map(e => e.nivelEducacional).filter(Boolean))];
        const categorias = [...new Set(equiposData.map(e => e.categoria).filter(Boolean))];

        setOpcionesGenero(generos);
        setOpcionesNivel(niveles);
        setOpcionesCategorias(categorias);

        console.log('📊 Datos cargados:', {
          equipos: equiposData.length,
          generos,
          niveles,
          categorias
        });

      } catch (error) {
        console.error("Error al cargar equipos:", error);
        setError("Error al cargar equipos");
      }
    };

    cargarEquipos();
  }, [discipline]);

  // Cargar partidos desde Firestore con onSnapshot
  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(matchesData);
      setLoading(false);
      
      console.log(`🔄 Partidos actualizados: ${matchesData.length}`);
    });

    return () => unsubscribe();
  }, [discipline]);

  // Validar fase seleccionada cuando cambian los filtros
  useEffect(() => {
    if (filtroGenero && filtroNivelEducacional && filtroCategoria) {
      const fasesDisponibles = verificarFasesExistentes();
      
      // Si la fase actual no existe, cambiar a la primera disponible
      if (!fasesDisponibles[faseActiva] && faseActiva !== "todas") {
        const primeraFaseDisponible = Object.keys(fasesDisponibles).find(fase => fasesDisponibles[fase]);
        if (primeraFaseDisponible) {
          setFaseActiva(primeraFaseDisponible);
        } else {
          setFaseActiva("todas");
        }
      }
    }
  }, [filtroGenero, filtroNivelEducacional, filtroCategoria, matches]);

  // ==================== FUNCIONES AUXILIARES ====================

  // Verificar qué fases existen en la categoría actual
  const verificarFasesExistentes = () => {
    if (!filtroGenero || !filtroNivelEducacional || !filtroCategoria) {
      return {
        grupos: false,
        semifinal: false,
        final: false,
        ida_vuelta: false
      };
    }

    const partidosCategoria = matches.filter(match => 
      match.genero === filtroGenero &&
      match.nivelEducacional === filtroNivelEducacional &&
      match.categoria === filtroCategoria
    );

    return {
      grupos: partidosCategoria.some(m => m.fase === "grupos" || !m.fase),
      semifinal: partidosCategoria.some(m => m.fase === "semifinal"),
      final: partidosCategoria.some(m => m.fase === "final" || m.fase === "tercer_puesto" || m.fase === "tercerPuesto"),
      ida_vuelta: partidosCategoria.some(m => m.fase === "ida" || m.fase === "vuelta" || m.fase === "desempate")
    };
  };

  // ==================== FUNCIONES DE GENERACIÓN DE PARTIDOS ====================

  // Obtener equipos filtrados
  const obtenerEquiposFiltrados = () => {
    return equipos.filter(equipo => 
      equipo.disciplina === discipline &&
      (!filtroGenero || equipo.genero === filtroGenero) &&
      (!filtroNivelEducacional || equipo.nivelEducacional === filtroNivelEducacional) &&
      (!filtroCategoria || equipo.categoria === filtroCategoria)
    );
  };

  // Generar partidos de fase de grupos (todos contra todos) o ida/vuelta según cantidad de equipos
  const generarPartidosGrupos = async () => {
    if (!filtroGenero || !filtroNivelEducacional || !filtroCategoria) {
      showToast("⚠️ Debes seleccionar género, nivel educacional y categoría", "warning");
      return;
    }

    try {
      const equiposFiltrados = obtenerEquiposFiltrados();
      
      if (equiposFiltrados.length < 2) {
        showToast(`⚠️ Se necesitan al menos 2 equipos. Encontrados: ${equiposFiltrados.length}`, "warning");
        return;
      }

      console.log(`🚀 Generando partidos para ${equiposFiltrados.length} equipos...`);

      // Verificar si ya existen partidos para esta categoría
      const partidosExistentes = matches.filter(m => 
        m.disciplina === discipline &&
        m.genero === filtroGenero &&
        m.nivelEducacional === filtroNivelEducacional &&
        m.categoria === filtroCategoria
      );

      if (partidosExistentes.length > 0) {
        if (!confirm(`Ya existen ${partidosExistentes.length} partidos para esta categoría. ¿Continuar generando más?`)) {
          return;
        }
      }

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Grupo Único";
        if (!equiposPorGrupo[grupo]) {
          equiposPorGrupo[grupo] = [];
        }
        equiposPorGrupo[grupo].push(equipo);
      });

      let partidosCreados = 0;

      // Procesar cada grupo
      for (const [nombreGrupo, equiposGrupo] of Object.entries(equiposPorGrupo)) {
        console.log(`📋 Procesando ${nombreGrupo} (${equiposGrupo.length} equipos)`);
        
        if (equiposGrupo.length === 2) {
          // Para 2 equipos: generar ida y vuelta
          console.log(`⚽ Generando ida y vuelta para ${nombreGrupo}`);
          partidosCreados += await generarIdaYVueltaPara2Equipos(equiposGrupo, nombreGrupo);
        } else {
          // Para más de 2 equipos: fase de grupos (todos contra todos)
          console.log(`🏃‍♂️ Generando fase de grupos para ${nombreGrupo}`);
          partidosCreados += await generarFaseGruposTodosContraTodos(equiposGrupo, nombreGrupo);
        }
      }

      const tipoPartidos = Object.values(equiposPorGrupo).some(grupo => grupo.length === 2) ? 
        "ida/vuelta y fase de grupos" : "fase de grupos";
      
      showToast(`✅ Se generaron ${partidosCreados} partidos (${tipoPartidos})`, "success");
      console.log(`✅ Total partidos creados: ${partidosCreados}`);

    } catch (error) {
      console.error("Error al generar partidos:", error);
      showToast("❌ Error al generar partidos", "error");
    }
  };

  // Función auxiliar para generar ida y vuelta entre 2 equipos
  const generarIdaYVueltaPara2Equipos = async (equipos, nombreGrupo) => {
    const [equipoA, equipoB] = equipos;
    let partidosCreados = 0;

    // Partido de ida
    await addDoc(collection(db, "matches"), {
      equipoA: {
        curso: equipoA.curso,
        paralelo: equipoA.paralelo,
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: filtroNivelEducacional
      },
      equipoB: {
        curso: equipoB.curso,
        paralelo: equipoB.paralelo,
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: filtroNivelEducacional
      },
      grupo: nombreGrupo === "Grupo Único" ? `${filtroCategoria} - ${filtroGenero}` : nombreGrupo,
      fase: "ida",
      estado: "programado",
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      goleadoresA: [],
      goleadoresB: [],
      observaciones: "Partido de ida"
    });
    partidosCreados++;

    // Partido de vuelta (equipos intercambiados)
    await addDoc(collection(db, "matches"), {
      equipoA: {
        curso: equipoB.curso,
        paralelo: equipoB.paralelo,
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: filtroNivelEducacional
      },
      equipoB: {
        curso: equipoA.curso,
        paralelo: equipoA.paralelo,
        genero: filtroGenero,
        categoria: filtroCategoria,
        nivelEducacional: filtroNivelEducacional
      },
      grupo: nombreGrupo === "Grupo Único" ? `${filtroCategoria} - ${filtroGenero}` : nombreGrupo,
      fase: "vuelta",
      estado: "programado",
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      goleadoresA: [],
      goleadoresB: [],
      observaciones: "Partido de vuelta"
    });
    partidosCreados++;

    return partidosCreados;
  };

  // Función auxiliar para generar fase de grupos (todos contra todos)
  const generarFaseGruposTodosContraTodos = async (equipos, nombreGrupo) => {
    let partidosCreados = 0;

    for (let i = 0; i < equipos.length; i++) {
      for (let j = i + 1; j < equipos.length; j++) {
        const equipoA = equipos[i];
        const equipoB = equipos[j];

        await addDoc(collection(db, "matches"), {
          equipoA: {
            curso: equipoA.curso,
            paralelo: equipoA.paralelo,
            genero: filtroGenero,
            categoria: filtroCategoria,
            nivelEducacional: filtroNivelEducacional
          },
          equipoB: {
            curso: equipoB.curso,
            paralelo: equipoB.paralelo,
            genero: filtroGenero,
            categoria: filtroCategoria,
            nivelEducacional: filtroNivelEducacional
          },
          grupo: nombreGrupo === "Grupo Único" ? `${filtroCategoria} - ${filtroGenero}` : nombreGrupo,
          fase: "grupos",
          estado: "programado",
          disciplina: discipline,
          categoria: filtroCategoria,
          genero: filtroGenero,
          nivelEducacional: filtroNivelEducacional,
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

    return partidosCreados;
  };

  // ==================== FUNCIONES DE ANÁLISIS DE CATEGORÍAS ====================

  // Obtener clasificación de un grupo
  const obtenerClasificacion = (nombreGrupo) => {
    const partidosGrupo = matches.filter(m => 
      m.grupo === nombreGrupo &&
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      (m.fase === "grupos" || !m.fase) &&
      m.estado === "finalizado"
    );

    const equiposStats = {};

    // Inicializar stats para todos los equipos del grupo
    const equiposGrupo = obtenerEquiposFiltrados().filter(e => {
      const grupoEquipo = e.grupo || "Grupo Único";
      return grupoEquipo === nombreGrupo || 
             (nombreGrupo === `${filtroCategoria} - ${filtroGenero}` && grupoEquipo === "Grupo Único");
    });

    equiposGrupo.forEach(equipo => {
      const key = `${equipo.curso} ${equipo.paralelo}`;
      equiposStats[key] = {
        curso: equipo.curso,
        paralelo: equipo.paralelo,
        puntos: 0,
        golesFavor: 0,
        golesContra: 0,
        partidosJugados: 0,
        partidosGanados: 0,
        partidosEmpatados: 0,
        partidosPerdidos: 0
      };
    });

    // Calcular estadísticas basadas en partidos finalizados
    partidosGrupo.forEach(partido => {
      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;
      
      if (equiposStats[equipoA] && equiposStats[equipoB]) {
        equiposStats[equipoA].partidosJugados++;
        equiposStats[equipoB].partidosJugados++;
        
        equiposStats[equipoA].golesFavor += partido.marcadorA || 0;
        equiposStats[equipoA].golesContra += partido.marcadorB || 0;
        equiposStats[equipoB].golesFavor += partido.marcadorB || 0;
        equiposStats[equipoB].golesContra += partido.marcadorA || 0;

        if (partido.marcadorA > partido.marcadorB) {
          equiposStats[equipoA].puntos += 3;
          equiposStats[equipoA].partidosGanados++;
          equiposStats[equipoB].partidosPerdidos++;
        } else if (partido.marcadorA < partido.marcadorB) {
          equiposStats[equipoB].puntos += 3;
          equiposStats[equipoB].partidosGanados++;
          equiposStats[equipoA].partidosPerdidos++;
        } else {
          equiposStats[equipoA].puntos += 1;
          equiposStats[equipoB].puntos += 1;
          equiposStats[equipoA].partidosEmpatados++;
          equiposStats[equipoB].partidosEmpatados++;
        }
      }
    });

    // Ordenar por puntos, diferencia de goles y goles a favor
    return Object.values(equiposStats).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      const difA = a.golesFavor - a.golesContra;
      const difB = b.golesFavor - b.golesContra;
      if (difB !== difA) return difB - difA;
      return b.golesFavor - a.golesFavor;
    });
  };

  // Analizar el estado de la categoría y determinar qué fases generar
  const analizarEstadoCategoria = () => {
    if (!filtroGenero || !filtroNivelEducacional || !filtroCategoria) {
      return { tipo: "sin_filtros" };
    }

    const equiposFiltrados = obtenerEquiposFiltrados();
    const equiposPorGrupo = {};
    
    equiposFiltrados.forEach(equipo => {
      const grupo = equipo.grupo || "Grupo Único";
      if (!equiposPorGrupo[grupo]) {
        equiposPorGrupo[grupo] = [];
      }
      equiposPorGrupo[grupo].push(equipo);
    });

    const gruposConEquipos = Object.keys(equiposPorGrupo).filter(g => equiposPorGrupo[g].length > 0);
    
    // Verificar si todos los partidos de grupos están finalizados
    const partidosGrupos = matches.filter(m => 
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      (m.fase === "grupos" || !m.fase)
    );
    
    const partidosPendientes = partidosGrupos.filter(p => p.estado !== "finalizado");
    const gruposCompletos = partidosPendientes.length === 0 && partidosGrupos.length > 0;

    const clasificaciones = {};
    gruposConEquipos.forEach(grupo => {
      clasificaciones[grupo] = obtenerClasificacion(grupo);
    });

    return {
      tipo: "analisis_completo",
      totalEquipos: equiposFiltrados.length,
      totalGrupos: gruposConEquipos.length,
      gruposConEquipos,
      equiposPorGrupo,
      clasificaciones,
      gruposCompletos,
      partidosGruposPendientes: partidosPendientes.length,
      totalPartidosGrupos: partidosGrupos.length
    };
  };

  // ==================== GENERACIÓN AUTOMÁTICA DE FASES FINALES ====================

  const generarFasesFinalesAutomaticas = async () => {
    const estado = analizarEstadoCategoria();
    
    if (estado.tipo === "sin_filtros") {
      showToast("⚠️ Selecciona todos los filtros primero", "warning");
      return;
    }

    if (!estado.gruposCompletos) {
      showToast(`⚠️ Completa todos los partidos de grupos primero (${estado.partidosGruposPendientes} pendientes)`, "warning");
      return;
    }

    try {
      console.log(`🏆 Generando fases finales automáticas...`);
      console.log(`📊 Estado:`, estado);

      // CASO 1: Categoría con 2 grupos - Semifinales cruzadas
      if (estado.totalGrupos === 2) {
        await generarSemifinalesCruzadas(estado);
      }
      // CASO 2: Categoría con 1 grupo y 4+ equipos - Final y tercer puesto
      else if (estado.totalGrupos === 1 && estado.totalEquipos >= 4) {
        await generarFinalYTercerPuesto(estado);
      }
      // CASO 3: Categoría con 1 grupo y 3 equipos - Solo final
      else if (estado.totalGrupos === 1 && estado.totalEquipos === 3) {
        await generarSoloFinal(estado);
      }
      // CASO 4: Categoría con 1 grupo y 2 equipos - Ida y vuelta
      else if (estado.totalGrupos === 1 && estado.totalEquipos === 2) {
        await generarIdaYVuelta(estado);
      }
      else {
        showToast(`⚠️ Configuración no soportada: ${estado.totalGrupos} grupos, ${estado.totalEquipos} equipos`, "warning");
      }

    } catch (error) {
      console.error("Error al generar fases finales:", error);
      showToast("❌ Error al generar fases finales", "error");
    }
  };

  // CASO 1: Semifinales cruzadas (2 grupos)
  const generarSemifinalesCruzadas = async (estado) => {
    const [grupo1, grupo2] = estado.gruposConEquipos;
    const clasificacion1 = estado.clasificaciones[grupo1];
    const clasificacion2 = estado.clasificaciones[grupo2];

    if (clasificacion1.length < 2 || clasificacion2.length < 2) {
      showToast("⚠️ Cada grupo necesita al menos 2 equipos para generar semifinales", "warning");
      return;
    }

    const primero1 = clasificacion1[0];
    const segundo1 = clasificacion1[1];
    const primero2 = clasificacion2[0];
    const segundo2 = clasificacion2[1];

    // Verificar si ya existen semifinales
    const semifinalesExistentes = matches.filter(m => 
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      m.fase === "semifinales"
    );

    if (semifinalesExistentes.length > 0) {
      showToast("⚠️ Ya existen semifinales para esta categoría", "warning");
      return;
    }

    // Crear semifinales cruzadas
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: primero1.curso, paralelo: primero1.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: segundo2.curso, paralelo: segundo2.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "semifinales",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `SF1 - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    await addDoc(collection(db, "matches"), {
      equipoA: { curso: primero2.curso, paralelo: primero2.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: segundo1.curso, paralelo: segundo1.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "semifinales",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `SF2 - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    showToast(`✅ Semifinales cruzadas generadas:\n• ${primero1.curso} ${primero1.paralelo} vs ${segundo2.curso} ${segundo2.paralelo}\n• ${primero2.curso} ${primero2.paralelo} vs ${segundo1.curso} ${segundo1.paralelo}`, "success");
  };

  // CASO 2: Final y tercer puesto (1 grupo, 4+ equipos)
  const generarFinalYTercerPuesto = async (estado) => {
    const grupo = estado.gruposConEquipos[0];
    const clasificacion = estado.clasificaciones[grupo];

    if (clasificacion.length < 4) {
      showToast("⚠️ Se necesitan al menos 4 equipos para generar final y tercer puesto", "warning");
      return;
    }

    // Verificar si ya existen finales
    const finalesExistentes = matches.filter(m => 
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      (m.fase === "final" || m.fase === "tercerPuesto")
    );

    if (finalesExistentes.length > 0) {
      showToast("⚠️ Ya existen partidos finales para esta categoría", "warning");
      return;
    }

    const primero = clasificacion[0];
    const segundo = clasificacion[1];
    const tercero = clasificacion[2];
    const cuarto = clasificacion[3];

    // Final: 1° vs 2°
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: primero.curso, paralelo: primero.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: segundo.curso, paralelo: segundo.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "final",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `Final - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    // Tercer puesto: 3° vs 4°
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: tercero.curso, paralelo: tercero.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: cuarto.curso, paralelo: cuarto.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "tercerPuesto",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `3er Puesto - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    showToast(`✅ Final y tercer puesto generados:\n• Final: ${primero.curso} ${primero.paralelo} vs ${segundo.curso} ${segundo.paralelo}\n• 3er Puesto: ${tercero.curso} ${tercero.paralelo} vs ${cuarto.curso} ${cuarto.paralelo}`, "success");
  };

  // CASO 3: Solo final (1 grupo, 3 equipos)
  const generarSoloFinal = async (estado) => {
    const grupo = estado.gruposConEquipos[0];
    const clasificacion = estado.clasificaciones[grupo];

    if (clasificacion.length < 2) {
      showToast("⚠️ Se necesitan al menos 2 equipos para generar final", "warning");
      return;
    }

    // Verificar si ya existe final
    const finalesExistentes = matches.filter(m => 
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      m.fase === "final"
    );

    if (finalesExistentes.length > 0) {
      showToast("⚠️ Ya existe una final para esta categoría", "warning");
      return;
    }

    const primero = clasificacion[0];
    const segundo = clasificacion[1];

    // Solo final: 1° vs 2°
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: primero.curso, paralelo: primero.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: segundo.curso, paralelo: segundo.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "final",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `Final - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    showToast(`✅ Final generada: ${primero.curso} ${primero.paralelo} vs ${segundo.curso} ${segundo.paralelo}`, "success");
  };

  // CASO 4: Ida y vuelta (1 grupo, 2 equipos)
  const generarIdaYVuelta = async (estado) => {
    const grupo = estado.gruposConEquipos[0];
    const clasificacion = estado.clasificaciones[grupo];

    if (clasificacion.length < 2) {
      showToast("⚠️ Se necesitan 2 equipos para generar ida y vuelta", "warning");
      return;
    }

    // Verificar si ya existen partidos de ida y vuelta
    const idaVueltaExistentes = matches.filter(m => 
      m.disciplina === discipline &&
      m.genero === filtroGenero &&
      m.nivelEducacional === filtroNivelEducacional &&
      m.categoria === filtroCategoria &&
      (m.fase === "ida" || m.fase === "vuelta")
    );

    if (idaVueltaExistentes.length > 0) {
      showToast("⚠️ Ya existen partidos de ida y vuelta para esta categoría", "warning");
      return;
    }

    const equipo1 = clasificacion[0];
    const equipo2 = clasificacion[1];

    // Partido de ida
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: equipo1.curso, paralelo: equipo1.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: equipo2.curso, paralelo: equipo2.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "ida",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `Ida - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    // Partido de vuelta
    await addDoc(collection(db, "matches"), {
      equipoA: { curso: equipo2.curso, paralelo: equipo2.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      equipoB: { curso: equipo1.curso, paralelo: equipo1.paralelo, genero: filtroGenero, categoria: filtroCategoria, nivelEducacional: filtroNivelEducacional },
      disciplina: discipline,
      categoria: filtroCategoria,
      genero: filtroGenero,
      nivelEducacional: filtroNivelEducacional,
      fase: "vuelta",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      grupo: `Vuelta - ${filtroCategoria} ${filtroGenero}`,
      goleadoresA: [],
      goleadoresB: []
    });

    showToast(`✅ Ida y vuelta generados:\n• Ida: ${equipo1.curso} ${equipo1.paralelo} vs ${equipo2.curso} ${equipo2.paralelo}\n• Vuelta: ${equipo2.curso} ${equipo2.paralelo} vs ${equipo1.curso} ${equipo1.paralelo}`, "success");
  };

  // ==================== FUNCIONES DE NAVEGACIÓN ====================

  const navegarADetalle = (matchId) => {
    if (discipline === "futbol") {
      navigate(`/admin/partido/${matchId}`);
    } else if (discipline === "basquet") {
      navigate(`/admin-basquet-match-detail/${matchId}`);
    } else if (discipline === "voley") {
      navigate(`/admin-voley-match-detail/${matchId}`);
    }
  };

  // ==================== FUNCIONES DE ELIMINACIÓN ====================

  // Eliminar un partido individual
  const eliminarPartido = async (partidoId) => {
    try {
      await deleteDoc(doc(db, "matches", partidoId));
      setMatches(prev => prev.filter(m => m.id !== partidoId));
      showToast("🗑️ Partido eliminado correctamente", "success");
    } catch (error) {
      console.error("Error al eliminar partido:", error);
      showToast("❌ Error al eliminar el partido", "error");
    }
  };

  // Confirmar eliminación de partido individual
  const confirmarEliminarPartido = (partido) => {
    setPartidoAEliminar(partido);
    setShowConfirmDelete(true);
  };

  // Eliminar todos los partidos de la categoría actual
  const eliminarPartidosCategoria = async () => {
    try {
      const partidosAEliminar = matches.filter(match => 
        match.genero === filtroGenero &&
        match.nivelEducacional === filtroNivelEducacional &&
        match.categoria === filtroCategoria &&
        match.disciplina === discipline
      );

      // Eliminar cada partido
      for (const partido of partidosAEliminar) {
        await deleteDoc(doc(db, "matches", partido.id));
      }

      setMatches(prev => prev.filter(m => 
        !(m.genero === filtroGenero &&
          m.nivelEducacional === filtroNivelEducacional &&
          m.categoria === filtroCategoria &&
          m.disciplina === discipline)
      ));

      showToast(`🗑️ ${partidosAEliminar.length} partidos eliminados de la categoría`, "success");
    } catch (error) {
      console.error("Error al eliminar partidos por categoría:", error);
      showToast("❌ Error al eliminar los partidos", "error");
    }
  };

  // Eliminar todos los partidos de la fase actual
  const eliminarPartidosFase = async () => {
    try {
      const partidosAEliminar = matches.filter(match => {
        const cumpleFiltros = match.genero === filtroGenero &&
                             match.nivelEducacional === filtroNivelEducacional &&
                             match.categoria === filtroCategoria &&
                             match.disciplina === discipline;
        
        if (faseActiva === "grupos") {
          return cumpleFiltros && (match.fase === "grupos" || !match.fase);
        } else if (faseActiva === "semifinal") {
          return cumpleFiltros && match.fase === "semifinal";
        } else if (faseActiva === "final") {
          return cumpleFiltros && (match.fase === "final" || match.fase === "tercer_puesto" || match.fase === "tercerPuesto");
        } else if (faseActiva === "ida_vuelta") {
          return cumpleFiltros && (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate");
        }
        return false;
      });

      // Eliminar cada partido
      for (const partido of partidosAEliminar) {
        await deleteDoc(doc(db, "matches", partido.id));
      }

      setMatches(prev => prev.filter(m => !partidosAEliminar.some(p => p.id === m.id)));

      const nombreFase = faseActiva === "grupos" ? "Fase de Grupos" :
                        faseActiva === "semifinal" ? "Semifinales" :
                        faseActiva === "final" ? "Finales" : "Ida y Vuelta";
      
      showToast(`🗑️ ${partidosAEliminar.length} partidos eliminados de ${nombreFase}`, "success");
    } catch (error) {
      console.error("Error al eliminar partidos por fase:", error);
      showToast("❌ Error al eliminar los partidos", "error");
    }
  };

  // Confirmar eliminación masiva
  const confirmarEliminarGrupo = (tipo) => {
    setTipoEliminacion(tipo);
    setShowConfirmDeleteGroup(true);
  };

  // Ejecutar eliminación masiva
  const ejecutarEliminacionMasiva = async () => {
    if (tipoEliminacion === "categoria") {
      await eliminarPartidosCategoria();
    } else if (tipoEliminacion === "fase") {
      await eliminarPartidosFase();
    }
    setShowConfirmDeleteGroup(false);
    setTipoEliminacion("");
  };

  // ==================== FILTROS PARA MOSTRAR DATOS ====================

  // Filtrar partidos según los filtros activos y fase
  const partidosFiltrados = matches.filter(match => {
    const cumpleFiltros = (!filtroGenero || match.genero === filtroGenero) &&
                         (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional) &&
                         (!filtroCategoria || match.categoria === filtroCategoria);
    
    // Filtrar por fase activa
    if (faseActiva === "grupos") {
      return cumpleFiltros && (match.fase === "grupos" || !match.fase);
    } else if (faseActiva === "semifinal") {
      return cumpleFiltros && match.fase === "semifinal";
    } else if (faseActiva === "final") {
      return cumpleFiltros && (match.fase === "final" || match.fase === "tercer_puesto" || match.fase === "tercerPuesto");
    } else if (faseActiva === "ida_vuelta") {
      return cumpleFiltros && (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate");
    } else if (faseActiva === "todas") {
      return cumpleFiltros;
    }
    
    return cumpleFiltros;
  });

  // Contar partidos por fase
  const contarPartidosPorFase = (fase) => {
    return matches.filter(match => {
      const cumpleFiltros = (!filtroGenero || match.genero === filtroGenero) &&
                           (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional) &&
                           (!filtroCategoria || match.categoria === filtroCategoria);
      
      if (fase === "grupos") {
        return cumpleFiltros && (match.fase === "grupos" || !match.fase);
      } else if (fase === "semifinal") {
        return cumpleFiltros && match.fase === "semifinal";
      } else if (fase === "final") {
        return cumpleFiltros && (match.fase === "final" || match.fase === "tercer_puesto" || match.fase === "tercerPuesto");
      } else if (fase === "ida_vuelta") {
        return cumpleFiltros && (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate");
      }
      
      return cumpleFiltros;
    }).length;
  };

  const fasesExistentes = verificarFasesExistentes();

  // Obtener texto dinámico para el botón de ida/vuelta
  const getTextoIdaVuelta = () => {
    const partidosIdaVuelta = matches.filter(match => {
      const cumpleFiltros = (!filtroGenero || match.genero === filtroGenero) &&
                           (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional) &&
                           (!filtroCategoria || match.categoria === filtroCategoria);
      return cumpleFiltros && (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate");
    });

    const ida = partidosIdaVuelta.filter(m => m.fase === "ida").length;
    const vuelta = partidosIdaVuelta.filter(m => m.fase === "vuelta").length;
    const desempate = partidosIdaVuelta.filter(m => m.fase === "desempate").length;
    
    let texto = "⚽ ";
    if (ida > 0 && vuelta > 0 && desempate > 0) {
      texto += `Ida/Vuelta/Desempate (${partidosIdaVuelta.length})`;
    } else if (ida > 0 && vuelta > 0) {
      texto += `Ida/Vuelta (${partidosIdaVuelta.length})`;
    } else if (ida > 0 || vuelta > 0) {
      texto += `${ida > 0 ? 'Ida' : 'Vuelta'} (${partidosIdaVuelta.length})`;
    } else if (desempate > 0) {
      texto += `Desempate (${desempate})`;
    } else {
      texto += `Ida/Vuelta (${partidosIdaVuelta.length})`;
    }
    
    return texto;
  };

  // Obtener opciones de filtros dependientes
  const getNivelesDisponibles = () => {
    if (!filtroGenero) return opcionesNivel;
    return opcionesNivel.filter(nivel => 
      equipos.some(e => 
        e.disciplina === discipline &&
        e.genero === filtroGenero &&
        e.nivelEducacional === nivel
      )
    );
  };

  const getCategoriasDisponibles = () => {
    if (!filtroGenero || !filtroNivelEducacional) return opcionesCategorias;
    return opcionesCategorias.filter(categoria => 
      equipos.some(e => 
        e.disciplina === discipline &&
        e.genero === filtroGenero &&
        e.nivelEducacional === filtroNivelEducacional &&
        e.categoria === categoria
      )
    );
  };

  // ==================== RENDER ====================

  if (loading) {
    return <div className="loading">Cargando partidos...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const estado = analizarEstadoCategoria();

  return (
    <div className="admin-matches">
      <h1>Gestión de Partidos - {discipline.charAt(0).toUpperCase() + discipline.slice(1)}</h1>
      
      {/* Navegación con botones de colores */}
      <div className="nav-buttons">
        <button 
          className="nav-button volver"
          onClick={() => navigate(`/admin`)}
        >
          ← Volver al Panel
        </button>
        <button
          className="nav-button equipos"
          onClick={() => navigate(`/admin/${discipline}/equipos`)}
        >
          📋 Equipos
        </button>
        <button
          className="nav-button partidos"
          onClick={() => navigate(`/admin/${discipline}/partidos`)}
        >
          ⚽ Partidos
        </button>
        <button
          className="nav-button posiciones"
          onClick={() => navigate(`/admin/${discipline}/tabla`)}
        >
          🏆 Posiciones
        </button>
        <button
          className="nav-button horarios"
          onClick={() => navigate(`/admin/${discipline}/horarios`)}
        >
          📅 Horarios
        </button>
      </div>
      
      {/* Contenedor de filtros */}
      <div className="filters-container">
        <h3>📊 Género:</h3>
        
        <div className="filters-row">
          <div className="filter-group">
            <label>🚻 Género: </label>
            <select 
              value={filtroGenero} 
              onChange={(e) => handleFiltroGeneroChange(e.target.value)}
            >
              <option value="">Selecciona un género</option>
              {opcionesGenero.map(genero => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🎓 Nivel Educacional: </label>
            <select 
              value={filtroNivelEducacional} 
              onChange={(e) => handleFiltroNivelEducacionalChange(e.target.value)}
              disabled={!filtroGenero}
            >
              <option value="">Primero selecciona un género</option>
              {getNivelesDisponibles().map(nivel => (
                <option key={nivel} value={nivel}>{nivel}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🏅 Categoría: </label>
            <select 
              value={filtroCategoria} 
              onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
              disabled={!filtroGenero || !filtroNivelEducacional}
            >
              <option value="">Primero selecciona género y nivel educacional</option>
              {getCategoriasDisponibles().map(categoria => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estado de la categoría */}
        {estado.tipo === "analisis_completo" && (
          <div className="category-status">
            <h3>📊 Estado de la Categoría: {filtroGenero} - {filtroNivelEducacional} - {filtroCategoria}</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-icon">👥</span>
                <strong>Equipos:</strong> {estado.totalEquipos}
              </div>
              <div className="status-item">
                <span className="status-icon">🏆</span>
                <strong>Grupos:</strong> {estado.totalGrupos}
              </div>
              <div className="status-item">
                <span className="status-icon">⚽</span>
                <strong>Partidos:</strong> {estado.totalPartidosGrupos}
              </div>
              <div className="status-item">
                <span className="status-icon">⏳</span>
                <strong>Pendientes:</strong> {estado.partidosGruposPendientes}
              </div>
              {estado.gruposCompletos && (
                <>
                  <div className="status-item">
                    <span className="status-icon">✅</span>
                    <strong>Estado:</strong> Listo para fases finales
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="action-buttons">
          <button 
            className="btn-generar"
            onClick={generarPartidosGrupos}
            disabled={!filtroGenero || !filtroNivelEducacional || !filtroCategoria}
          >
            ⚽ Generar Partidos (Grupos o Ida/Vuelta)
          </button>
          
          {estado.tipo === "analisis_completo" && estado.gruposCompletos && (
            <button 
              className="btn-generar-fases"
              onClick={generarFasesFinalesAutomaticas}
            >
              🏆 Generar Fases Finales Automáticas
            </button>
          )}
        </div>
      </div>
      
      {/* Pestañas de fases */}
      {(filtroGenero && filtroNivelEducacional && filtroCategoria) && (
        <div className="phase-tabs">
          {fasesExistentes.grupos && (
            <button 
              className={`phase-tab grupos ${faseActiva === "grupos" ? "active" : ""}`}
              onClick={() => setFaseActiva("grupos")}
            >
              🏃‍♂️ Fase de Grupos ({contarPartidosPorFase("grupos")})
            </button>
          )}
          
          {fasesExistentes.semifinal && (
            <button 
              className={`phase-tab semifinales ${faseActiva === "semifinal" ? "active" : ""}`}
              onClick={() => setFaseActiva("semifinal")}
            >
              🔥 Semifinales ({contarPartidosPorFase("semifinal")})
            </button>
          )}
          
          {fasesExistentes.final && (
            <button 
              className={`phase-tab finales ${faseActiva === "final" ? "active" : ""}`}
              onClick={() => setFaseActiva("final")}
            >
              🏆 Finales ({contarPartidosPorFase("final")})
            </button>
          )}
          
          {fasesExistentes.ida_vuelta && (
            <button 
              className={`phase-tab ida-vuelta ${faseActiva === "ida_vuelta" ? "active" : ""}`}
              onClick={() => setFaseActiva("ida_vuelta")}
            >
              {getTextoIdaVuelta()}
            </button>
          )}
          
          {Object.values(fasesExistentes).filter(Boolean).length > 1 && (
            <button 
              className={`phase-tab todas ${faseActiva === "todas" ? "active" : ""}`}
              onClick={() => setFaseActiva("todas")}
            >
              📋 Todas las Fases ({partidosFiltrados.length})
            </button>
          )}
        </div>
      )}

      {/* Botones de eliminación masiva */}
      {(filtroGenero && filtroNivelEducacional && filtroCategoria && partidosFiltrados.length > 0) && (
        <div className="elimination-buttons">
          <button 
            className="btn-eliminar-fase"
            onClick={() => confirmarEliminarGrupo("fase")}
            title="Eliminar todos los partidos de la fase actual"
          >
            🗑️ Eliminar Fase Actual ({contarPartidosPorFase(faseActiva)})
          </button>
          <button 
            className="btn-eliminar-categoria"
            onClick={() => confirmarEliminarGrupo("categoria")}
            title="Eliminar todos los partidos de esta categoría"
          >
            🗑️ Eliminar Toda la Categoría ({partidosFiltrados.length})
          </button>
        </div>
      )}
        
      {/* Lista de partidos */}
      {partidosFiltrados.length === 0 ? (
        <div className="no-partidos">
          {filtroGenero && filtroNivelEducacional && filtroCategoria ? 
            "No hay partidos para esta categoría" : 
            "Selecciona los filtros para ver partidos"
          }
        </div>
      ) : (
        <div className="partidos-container">
          <div className="partidos-header">
            🏆 Partidos ({partidosFiltrados.length})
          </div>
          <div className="partidos-content">
            {(() => {
              // Agrupar partidos por grupo o fase
              const partidosPorGrupo = {};
              partidosFiltrados.forEach(match => {
                let claveGrupo;
                
                if (match.fase === "semifinal") {
                  claveGrupo = "Semifinales";
                } else if (match.fase === "final") {
                  claveGrupo = "Final";
                } else if (match.fase === "tercer_puesto" || match.fase === "tercerPuesto") {
                  claveGrupo = "Tercer Puesto";
                } else if (match.fase === "ida") {
                  claveGrupo = "Partidos de Ida";
                } else if (match.fase === "vuelta") {
                  claveGrupo = "Partidos de Vuelta";
                } else if (match.fase === "desempate") {
                  claveGrupo = "Desempates";
                } else {
                  claveGrupo = match.grupo || "Sin Grupo";
                }
                
                if (!partidosPorGrupo[claveGrupo]) {
                  partidosPorGrupo[claveGrupo] = [];
                }
                partidosPorGrupo[claveGrupo].push(match);
              });

              return Object.entries(partidosPorGrupo).map(([nombreGrupo, partidos]) => (
                <div key={nombreGrupo} className="partidos-grupo">
                  <h3 className="grupo-titulo">
                    {nombreGrupo} ({partidos.length} {partidos.length === 1 ? 'partido' : 'partidos'})
                  </h3>
                  <div className="partidos-grid">
                    {partidos.map(match => (
                      <div key={match.id} className="partido-card">
                        <div className="partido-header">
                          <span className={`partido-fase ${match.fase?.toUpperCase() || 'GRUPOS'}`}>
                            {match.fase === "ida" ? "IDA" :
                             match.fase === "vuelta" ? "VUELTA" :
                             match.fase === "desempate" ? "DESEMPATE" :
                             match.fase === "semifinal" || match.fase === "semifinales" ? "SEMIFINAL" :
                             match.fase === "final" || match.fase === "finales" ? "FINAL" :
                             (match.fase === "tercer_puesto" || match.fase === "tercerPuesto") ? "3ER PUESTO" :
                             match.fase === "grupos3" ? "FASE DE GRUPOS" :
                             match.fase === "grupos2" ? "FASE DE GRUPOS" :
                             "FASE DE GRUPOS"}
                          </span>
                          <span className={`partido-estado ${match.estado?.toUpperCase() || 'PROGRAMADO'}`}>
                            {match.estado || 'PROGRAMADO'}
                          </span>
                        </div>
                        
                        <div className="partido-equipos">
                          <div className="equipo">
                            <div className="equipo-nombre">{match.equipoA?.curso} {match.equipoA?.paralelo}</div>
                            <div className="equipo-score">{match.marcadorA || 0}</div>
                          </div>
                          <div className="vs">VS</div>
                          <div className="equipo">
                            <div className="equipo-nombre">{match.equipoB?.curso} {match.equipoB?.paralelo}</div>
                            <div className="equipo-score">{match.marcadorB || 0}</div>
                          </div>
                        </div>
                        
                        <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '12px', color: '#666', fontWeight: '500' }}>
                          {match.fecha} {match.hora}
                        </div>
                        
                        <div className="partido-actions">
                          <button
                            onClick={() => navegarADetalle(match.id)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            Ver Detalle
                          </button>
                          <button 
                            className="btn-eliminar"
                            onClick={() => confirmarEliminarPartido(match)}
                            title="Eliminar partido"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          }
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar partido individual */}
      {showConfirmDelete && partidoAEliminar && (
        <div className="modal">
          <div className="modal-content">
            <h3>🗑️ Confirmar Eliminación</h3>
            <p>¿Estás seguro de que quieres eliminar este partido?</p>
            <div style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <strong>{partidoAEliminar.equipoA?.curso} {partidoAEliminar.equipoA?.paralelo}</strong>
              <span> vs </span>
              <strong>{partidoAEliminar.equipoB?.curso} {partidoAEliminar.equipoB?.paralelo}</strong>
            </div>
            <p style={{ color: '#dc3545', fontSize: '14px' }}>Esta acción no se puede deshacer.</p>
            <div className="modal-buttons">
              <button 
                className="btn-confirmar"
                onClick={() => {
                  eliminarPartido(partidoAEliminar.id);
                  setShowConfirmDelete(false);
                  setPartidoAEliminar(null);
                }}
              >
                Sí, Eliminar
              </button>
              <button 
                className="btn-cancelar"
                onClick={() => {
                  setShowConfirmDelete(false);
                  setPartidoAEliminar(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminación masiva */}
      {showConfirmDeleteGroup && (
        <div className="modal">
          <div className="modal-content">
            <h3>🗑️ Confirmar Eliminación Masiva</h3>
            {tipoEliminacion === "categoria" ? (
              <>
                <p>¿Estás seguro de que quieres eliminar <strong>TODOS</strong> los partidos de esta categoría?</p>
                <div style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <strong>Categoría:</strong> {filtroGenero} - {filtroNivelEducacional} - {filtroCategoria}<br/>
                  <strong>Total de partidos:</strong> {partidosFiltrados.length}
                </div>
              </>
            ) : (
              <>
                <p>¿Estás seguro de que quieres eliminar todos los partidos de la fase actual?</p>
                <div style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <strong>Fase:</strong> {
                    faseActiva === "grupos" ? "Fase de Grupos" :
                    faseActiva === "semifinal" ? "Semifinales" :
                    faseActiva === "final" ? "Finales" : "Ida y Vuelta"
                  }<br/>
                  <strong>Total de partidos:</strong> {contarPartidosPorFase(faseActiva)}
                </div>
              </>
            )}
            <p style={{ color: '#dc3545', fontSize: '14px', fontWeight: 'bold' }}>⚠️ Esta acción no se puede deshacer y eliminará todos los partidos seleccionados.</p>
            <div className="modal-buttons">
              <button 
                className="btn-confirmar"
                onClick={ejecutarEliminacionMasiva}
              >
                Sí, Eliminar Todo
              </button>
              <button 
                className="btn-cancelar"
                onClick={() => {
                  setShowConfirmDeleteGroup(false);
                  setTipoEliminacion("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== FUNCIONES EXPORTADAS PARA COMPATIBILIDAD ====================

// Función para verificar y generar partido de desempate si es necesario
const verificarYGenerarDesempate = async (partidoFinalizado, showToast) => {
  try {
    // Solo procesar si el partido es de ida o vuelta
    if (partidoFinalizado.fase !== "ida" && partidoFinalizado.fase !== "vuelta") {
      return;
    }

    console.log(`🔍 Verificando desempate para partido de ${partidoFinalizado.fase}`);

    // Obtener todos los partidos de la misma categoría
    const { getDocs, query, collection, where } = await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", partidoFinalizado.disciplina),
      where("genero", "==", partidoFinalizado.genero),
      where("nivelEducacional", "==", partidoFinalizado.nivelEducacional),
      where("categoria", "==", partidoFinalizado.categoria),
      where("grupo", "==", partidoFinalizado.grupo)
    );

    const snapshot = await getDocs(q);
    const todosLosPartidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filtrar partidos de ida y vuelta finalizados
    const partidosIdaVuelta = todosLosPartidos.filter(p => 
      (p.fase === "ida" || p.fase === "vuelta") && p.estado === "finalizado"
    );

    // Si ambos partidos (ida y vuelta) están finalizados
    if (partidosIdaVuelta.length === 2) {
      const partidoIda = partidosIdaVuelta.find(p => p.fase === "ida");
      const partidoVuelta = partidosIdaVuelta.find(p => p.fase === "vuelta");

      if (partidoIda && partidoVuelta) {
        // Calcular resultado agregado
        const resultadoAgregado = calcularResultadoAgregado(partidoIda, partidoVuelta);
        
        if (resultadoAgregado.empate) {
          // Verificar si ya existe un partido de desempate
          const desempateExistente = todosLosPartidos.find(p => p.fase === "desempate");
          
          if (!desempateExistente) {
            console.log("⚖️ Empate detectado, generando partido de desempate...");
            await generarPartidoDesempate(partidoIda, partidoVuelta);
            
            if (showToast && typeof showToast === 'function') {
              showToast("⚖️ ¡Empate en ida y vuelta! Se generó partido de desempate automáticamente.", "info");
            }
          }
        } else {
          console.log("🏆 Ya hay un ganador en el resultado agregado, no se necesita desempate");
        }
      }
    }

  } catch (error) {
    console.error("Error al verificar desempate:", error);
  }
};

// Función para calcular el resultado agregado de ida y vuelta
const calcularResultadoAgregado = (partidoIda, partidoVuelta) => {
  // Identificar qué equipos jugaron (pueden estar en diferente orden)
  const equipoAOriginal = `${partidoIda.equipoA.curso} ${partidoIda.equipoA.paralelo}`;
  const equipoBOriginal = `${partidoIda.equipoB.curso} ${partidoIda.equipoB.paralelo}`;
  
  const equipoAVuelta = `${partidoVuelta.equipoA.curso} ${partidoVuelta.equipoA.paralelo}`;
  const equipoBVuelta = `${partidoVuelta.equipoB.curso} ${partidoVuelta.equipoB.paralelo}`;

  let golesEquipoA = 0;
  let golesEquipoB = 0;

  // Sumar goles del partido de ida
  golesEquipoA += partidoIda.marcadorA || 0;
  golesEquipoB += partidoIda.marcadorB || 0;

  // Sumar goles del partido de vuelta (considerando que pueden estar intercambiados)
  if (equipoAOriginal === equipoAVuelta) {
    // Mismo orden
    golesEquipoA += partidoVuelta.marcadorA || 0;
    golesEquipoB += partidoVuelta.marcadorB || 0;
  } else {
    // Orden intercambiado
    golesEquipoA += partidoVuelta.marcadorB || 0;
    golesEquipoB += partidoVuelta.marcadorA || 0;
  }

  console.log(`📊 Resultado agregado: ${equipoAOriginal}: ${golesEquipoA}, ${equipoBOriginal}: ${golesEquipoB}`);

  return {
    equipoA: equipoAOriginal,
    equipoB: equipoBOriginal,
    golesA: golesEquipoA,
    golesB: golesEquipoB,
    empate: golesEquipoA === golesEquipoB
  };
};

// Función para generar partido de desempate
const generarPartidoDesempate = async (partidoIda, partidoVuelta) => {
  try {
    const { addDoc, collection } = await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    // Usar los equipos del partido de ida en su orden original
    await addDoc(collection(db, "matches"), {
      equipoA: partidoIda.equipoA,
      equipoB: partidoIda.equipoB,
      grupo: partidoIda.grupo,
      fase: "desempate",
      estado: "programado",
      disciplina: partidoIda.disciplina,
      categoria: partidoIda.categoria,
      genero: partidoIda.genero,
      nivelEducacional: partidoIda.nivelEducacional,
      marcadorA: 0,
      marcadorB: 0,
      fecha: "",
      hora: "",
      goleadoresA: [],
      goleadoresB: [],
      observaciones: "Partido de desempate generado automáticamente por empate en ida y vuelta"
    });

    console.log("⚖️ Partido de desempate generado exitosamente");

  } catch (error) {
    console.error("Error al generar partido de desempate:", error);
  }
};

// Función para verificar y generar semifinales para múltiples grupos
const verificarYGenerarSemifinalesMultiplesGrupos = async (partidoFinalizado, showToast) => {
  try {
    // Solo procesar si el partido es de fase de grupos
    if (partidoFinalizado.fase !== "grupos" && partidoFinalizado.fase) {
      console.log("🔍 Partido no es de grupos, saltando verificación de semifinales");
      return;
    }

    console.log("🔍 Verificando si se necesitan generar semifinales para múltiples grupos...");
    
    // Validar que todos los campos necesarios estén presentes
    const camposRequeridos = ['disciplina', 'genero', 'nivelEducacional', 'categoria'];
    const camposFaltantes = camposRequeridos.filter(campo => !partidoFinalizado[campo]);
    
    if (camposFaltantes.length > 0) {
      console.log(`❌ Campos faltantes en partidoFinalizado: ${camposFaltantes.join(', ')}`);
      console.log("📋 Datos del partido:", partidoFinalizado);
      return;
    }

    console.log(`✅ Campos validados - Disciplina: ${partidoFinalizado.disciplina}, G��nero: ${partidoFinalizado.genero}, Nivel: ${partidoFinalizado.nivelEducacional}, Categoría: ${partidoFinalizado.categoria}`);

    // Obtener todos los partidos de la misma categoría
    const { getDocs, query, collection, where } = await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", partidoFinalizado.disciplina),
      where("genero", "==", partidoFinalizado.genero),
      where("nivelEducacional", "==", partidoFinalizado.nivelEducacional),
      where("categoria", "==", partidoFinalizado.categoria)
    );

    const snapshot = await getDocs(q);
    const todosLosPartidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filtrar solo partidos de grupos
    const partidosGrupos = todosLosPartidos.filter(p => 
      p.fase === "grupos" || !p.fase
    );

    // Verificar si ya existen semifinales
    const semifinalesExistentes = todosLosPartidos.filter(p => p.fase === "semifinal");
    if (semifinalesExistentes.length > 0) {
      console.log("🏆 Ya existen semifinales, no se generan nuevas");
      return;
    }

    // Agrupar partidos por grupo
    const partidosPorGrupo = {};
    partidosGrupos.forEach(partido => {
      const grupo = partido.grupo;
      if (!partidosPorGrupo[grupo]) {
        partidosPorGrupo[grupo] = [];
      }
      partidosPorGrupo[grupo].push(partido);
    });

    const grupos = Object.keys(partidosPorGrupo);
    console.log(`📊 Grupos encontrados: ${grupos.length} - ${grupos.join(', ')}`);

    // Solo proceder si hay múltiples grupos (2 o más)
    if (grupos.length < 2) {
      console.log("🔍 Solo hay un grupo o ninguno, no se necesitan semifinales entre grupos");
      return;
    }

    // Verificar que TODOS los grupos estén completos
    let todosGruposCompletos = true;
    const equiposPorGrupo = {};

    for (const grupo of grupos) {
      const partidosGrupo = partidosPorGrupo[grupo];
      const partidosFinalizados = partidosGrupo.filter(p => p.estado === "finalizado");
      
      // Obtener equipos únicos del grupo
      const equiposGrupo = new Set();
      partidosGrupo.forEach(partido => {
        equiposGrupo.add(`${partido.equipoA.curso} ${partido.equipoA.paralelo}`);
        equiposGrupo.add(`${partido.equipoB.curso} ${partido.equipoB.paralelo}`);
      });
      
      const numEquipos = equiposGrupo.size;
      const partidosEsperados = (numEquipos * (numEquipos - 1)) / 2; // Combinaciones n(n-1)/2
      
      console.log(`📋 Grupo ${grupo}: ${partidosFinalizados.length}/${partidosEsperados} partidos finalizados (${numEquipos} equipos)`);
      
      if (partidosFinalizados.length < partidosEsperados) {
        console.log(`⏳ Grupo ${grupo} aún no está completo`);
        todosGruposCompletos = false;
        break;
      }

      // Obtener clasificación del grupo
      equiposPorGrupo[grupo] = {
        equipos: Array.from(equiposGrupo),
        partidos: partidosGrupo,
        clasificacion: calcularClasificacionGrupo(partidosGrupo, Array.from(equiposGrupo))
      };
    }

    if (!todosGruposCompletos) {
      console.log("⏳ No todos los grupos están completos, esperando...");
      return;
    }

    console.log("🎯 ¡TODOS LOS GRUPOS ESTÁN COMPLETOS! Generando semifinales...");

    // Generar semifinales cruzadas
    await generarSemifinalesCruzadasMultiplesGrupos(equiposPorGrupo, partidoFinalizado, showToast);

  } catch (error) {
    console.error("Error al verificar semifinales múltiples grupos:", error);
  }
};

// Función para calcular la clasificación de un grupo
const calcularClasificacionGrupo = (partidos, equipos) => {
  const stats = {};
  
  // Inicializar estadísticas
  equipos.forEach(equipo => {
    stats[equipo] = {
      nombre: equipo,
      puntos: 0,
      goles_favor: 0,
      goles_contra: 0,
      diferencia: 0,
      partidos_jugados: 0,
      victorias: 0,
      empates: 0,
      derrotas: 0
    };
  });

  // Calcular estadísticas de partidos finalizados
  partidos
    .filter(partido => partido.estado === "finalizado")
    .forEach(partido => {
      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;
      const golesA = partido.marcadorA || 0;
      const golesB = partido.marcadorB || 0;

      if (stats[equipoA] && stats[equipoB]) {
        // Actualizar estadísticas equipo A
        stats[equipoA].goles_favor += golesA;
        stats[equipoA].goles_contra += golesB;
        stats[equipoA].partidos_jugados++;

        // Actualizar estadísticas equipo B
        stats[equipoB].goles_favor += golesB;
        stats[equipoB].goles_contra += golesA;
        stats[equipoB].partidos_jugados++;

        // Determinar resultado
        if (golesA > golesB) {
          stats[equipoA].puntos += 3;
          stats[equipoA].victorias++;
          stats[equipoB].derrotas++;
        } else if (golesB > golesA) {
          stats[equipoB].puntos += 3;
          stats[equipoB].victorias++;
          stats[equipoA].derrotas++;
        } else {
          stats[equipoA].puntos += 1;
          stats[equipoB].puntos += 1;
          stats[equipoA].empates++;
          stats[equipoB].empates++;
        }
      }
    });

  // Calcular diferencia de goles
  Object.values(stats).forEach(equipo => {
    equipo.diferencia = equipo.goles_favor - equipo.goles_contra;
  });

  // Ordenar por puntos, diferencia de goles, goles a favor
  return Object.values(stats).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
    return b.goles_favor - a.goles_favor;
  });
};

// Función para generar semifinales cruzadas entre múltiples grupos
const generarSemifinalesCruzadasMultiplesGrupos = async (equiposPorGrupo, partidoBase, showToast) => {
  try {
    const { addDoc, collection } = await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    const grupos = Object.keys(equiposPorGrupo);
    console.log(`🏆 Generando semifinales cruzadas para ${grupos.length} grupos`);

    // Si son exactamente 2 grupos, hacer semifinales cruzadas
    if (grupos.length === 2) {
      const [grupo1, grupo2] = grupos;
      const clasificacion1 = equiposPorGrupo[grupo1].clasificacion;
      const clasificacion2 = equiposPorGrupo[grupo2].clasificacion;

      console.log(`📊 Clasificación ${grupo1}:`, clasificacion1.map(e => `${e.nombre} (${e.puntos}pts)`));
      console.log(`📊 Clasificación ${grupo2}:`, clasificacion2.map(e => `${e.nombre} (${e.puntos}pts)`));

      // Tomar los primeros 2 de cada grupo (o todos si hay menos)
      const clasificados1 = clasificacion1.slice(0, 2);
      const clasificados2 = clasificacion2.slice(0, 2);

      // Generar semifinales cruzadas: 1°A vs 2°B y 1°B vs 2°A
      if (clasificados1.length >= 1 && clasificados2.length >= 1) {
        // Semifinal 1: 1�� del Grupo 1 vs 2° del Grupo 2 (si existe)
        const equipo1_1 = clasificados1[0];
        const equipo2_2 = clasificados2[1] || clasificados2[0]; // Si solo hay 1 clasificado del grupo 2

        const [curso1_1, paralelo1_1] = equipo1_1.nombre.split(' ');
        const [curso2_2, paralelo2_2] = equipo2_2.nombre.split(' ');

        await addDoc(collection(db, "matches"), {
          equipoA: {
            curso: curso1_1,
            paralelo: paralelo1_1,
            genero: partidoBase.genero,
            categoria: partidoBase.categoria,
            nivelEducacional: partidoBase.nivelEducacional
          },
          equipoB: {
            curso: curso2_2,
            paralelo: paralelo2_2,
            genero: partidoBase.genero,
            categoria: partidoBase.categoria,
            nivelEducacional: partidoBase.nivelEducacional
          },
          grupo: `Semifinales - ${partidoBase.categoria}`,
          fase: "semifinal",
          estado: "programado",
          disciplina: partidoBase.disciplina,
          categoria: partidoBase.categoria,
          genero: partidoBase.genero,
          nivelEducacional: partidoBase.nivelEducacional,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: [],
          observaciones: `Semifinal 1: 1° ${grupo1} vs 2° ${grupo2}`
        });

        console.log(`🏆 Semifinal 1 creada: ${equipo1_1.nombre} vs ${equipo2_2.nombre}`);
      }

      if (clasificados1.length >= 2 && clasificados2.length >= 1) {
        // Semifinal 2: 1° del Grupo 2 vs 2° del Grupo 1
        const equipo2_1 = clasificados2[0];
        const equipo1_2 = clasificados1[1];

        const [curso2_1, paralelo2_1] = equipo2_1.nombre.split(' ');
        const [curso1_2, paralelo1_2] = equipo1_2.nombre.split(' ');

        await addDoc(collection(db, "matches"), {
          equipoA: {
            curso: curso2_1,
            paralelo: paralelo2_1,
            genero: partidoBase.genero,
            categoria: partidoBase.categoria,
            nivelEducacional: partidoBase.nivelEducacional
          },
          equipoB: {
            curso: curso1_2,
            paralelo: paralelo1_2,
            genero: partidoBase.genero,
            categoria: partidoBase.categoria,
            nivelEducacional: partidoBase.nivelEducacional
          },
          grupo: `Semifinales - ${partidoBase.categoria}`,
          fase: "semifinal",
          estado: "programado",
          disciplina: partidoBase.disciplina,
          categoria: partidoBase.categoria,
          genero: partidoBase.genero,
          nivelEducacional: partidoBase.nivelEducacional,
          marcadorA: 0,
          marcadorB: 0,
          fecha: "",
          hora: "",
          goleadoresA: [],
          goleadoresB: [],
          observaciones: `Semifinal 2: 1° ${grupo2} vs 2° ${grupo1}`
        });

        console.log(`🏆 Semifinal 2 creada: ${equipo2_1.nombre} vs ${equipo1_2.nombre}`);
      }

      if (showToast && typeof showToast === 'function') {
        showToast("🏆 ¡Semifinales generadas automáticamente! Los grupos están completos.", "success");
      }

      console.log("✅ Semifinales cruzadas generadas exitosamente");
    } else {
      console.log(`⚠️ Número de grupos no soportado para semifinales automáticas: ${grupos.length}`);
    }

  } catch (error) {
    console.error("Error al generar semifinales cruzadas:", error);
  }
};

// Función para verificar y generar final cuando se completan las semifinales
const verificarYGenerarFinalDesdeSemifinales = async (partidoFinalizado, showToast) => {
  try {
    // Solo procesar si el partido es de semifinal
    if (partidoFinalizado.fase !== "semifinal") {
      console.log("🔍 Partido no es de semifinal, saltando verificación de final");
      return;
    }

    console.log("🏆 Verificando si se debe generar final tras completar semifinal...");
    
    // Validar que todos los campos necesarios estén presentes
    const camposRequeridos = ['disciplina', 'genero', 'nivelEducacional', 'categoria'];
    const camposFaltantes = camposRequeridos.filter(campo => !partidoFinalizado[campo]);
    
    if (camposFaltantes.length > 0) {
      console.log(`❌ Campos faltantes en partidoFinalizado: ${camposFaltantes.join(', ')}`);
      return;
    }

    // Obtener todas las semifinales de la misma categoría
    const { getDocs, query, collection, where, addDoc } = await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    const qSemifinales = query(
      collection(db, "matches"),
      where("disciplina", "==", partidoFinalizado.disciplina),
      where("genero", "==", partidoFinalizado.genero),
      where("nivelEducacional", "==", partidoFinalizado.nivelEducacional),
      where("categoria", "==", partidoFinalizado.categoria),
      where("fase", "==", "semifinal")
    );

    const snapshotSemifinales = await getDocs(qSemifinales);
    const semifinales = snapshotSemifinales.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`🔍 Semifinales encontradas: ${semifinales.length}`, semifinales.map(s => ({
      id: s.id,
      estado: s.estado,
      observaciones: s.observaciones,
      marcadorA: s.marcadorA,
      marcadorB: s.marcadorB
    })));

    // Verificar si todas las semifinales están finalizadas
    const semifinalesFinalizadas = semifinales.filter(s => s.estado === "finalizado");
    
    if (semifinalesFinalizadas.length < 2) {
      console.log(`⏳ Solo ${semifinalesFinalizadas.length}/2 semifinales finalizadas. Esperando...`);
      return;
    }

    console.log(`✅ Todas las semifinales (${semifinalesFinalizadas.length}) están finalizadas. Generando final y tercer puesto...`);

    // Verificar si ya existe una final para esta categoría
    const qFinal = query(
      collection(db, "matches"),
      where("disciplina", "==", partidoFinalizado.disciplina),
      where("genero", "==", partidoFinalizado.genero),
      where("nivelEducacional", "==", partidoFinalizado.nivelEducacional),
      where("categoria", "==", partidoFinalizado.categoria),
      where("fase", "==", "final")
    );

    const snapshotFinal = await getDocs(qFinal);
    if (!snapshotFinal.empty) {
      console.log("🏆 Final ya existe para esta categoría");
      return;
    }

    // Obtener ganadores y perdedores de semifinales
    const resultadosSemifinales = semifinalesFinalizadas.map(semifinal => {
      const ganador = semifinal.marcadorA > semifinal.marcadorB ? 
        { equipo: semifinal.equipoA, marcador: semifinal.marcadorA } : 
        { equipo: semifinal.equipoB, marcador: semifinal.marcadorB };
      
      const perdedor = semifinal.marcadorA > semifinal.marcadorB ? 
        { equipo: semifinal.equipoB, marcador: semifinal.marcadorB } : 
        { equipo: semifinal.equipoA, marcador: semifinal.marcadorA };

      return { ganador, perdedor, semifinal };
    });

    console.log("🏆 Resultados semifinales:", resultadosSemifinales);

    // Crear la final (ganador semifinal 1 vs ganador semifinal 2)
    const finalData = {
      disciplina: partidoFinalizado.disciplina,
      categoria: partidoFinalizado.categoria,
      genero: partidoFinalizado.genero,
      nivelEducacional: partidoFinalizado.nivelEducacional,
      fase: "final",
      grupo: "", // Final no tiene grupo específico
      equipoA: resultadosSemifinales[0].ganador.equipo,
      equipoB: resultadosSemifinales[1].ganador.equipo,
      fecha: "",
      hora: "",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      goleadoresA: [],
      goleadoresB: [],
      observaciones: "Final generada automáticamente tras completar semifinales"
    };

    // Crear el tercer puesto (perdedor semifinal 1 vs perdedor semifinal 2)
    const tercerPuestoData = {
      disciplina: partidoFinalizado.disciplina,
      categoria: partidoFinalizado.categoria,
      genero: partidoFinalizado.genero,
      nivelEducacional: partidoFinalizado.nivelEducacional,
      fase: "tercerPuesto",
      grupo: "", // Tercer puesto no tiene grupo específico
      equipoA: resultadosSemifinales[0].perdedor.equipo,
      equipoB: resultadosSemifinales[1].perdedor.equipo,
      fecha: "",
      hora: "",
      estado: "programado",
      marcadorA: 0,
      marcadorB: 0,
      goleadoresA: [],
      goleadoresB: [],
      observaciones: "Tercer puesto generado automáticamente tras completar semifinales"
    };

    // Guardar la final
    await addDoc(collection(db, "matches"), finalData);
    console.log("🏆 Final generada automáticamente");

    // Guardar el tercer puesto
    await addDoc(collection(db, "matches"), tercerPuestoData);
    console.log("🥉 Tercer puesto generado automáticamente");

    if (showToast && typeof showToast === 'function') {
      showToast("🏆 Final y tercer puesto generados automáticamente tras completar semifinales", "success");
    }

  } catch (error) {
    console.error("Error al generar final desde semifinales:", error);
    if (showToast && typeof showToast === 'function') {
      showToast("❌ Error al generar final automática", "error");
    }
  }
};

// Función exportada para que AdminMatchDetail pueda verificar fases finales
export const verificarYGenerarFasesFinalesExterna = async (partidoFinalizado, showToast) => {
  try {
    console.log("🔄 Verificación externa de fases finales desde AdminMatchDetail");
    console.log("🏆 Partido finalizado:", partidoFinalizado);
    
    // 1. Verificar si es necesario generar partido de desempate para ida/vuelta
    await verificarYGenerarDesempate(partidoFinalizado, showToast);
    
    // 2. Verificar si es necesario generar semifinales para múltiples grupos
    await verificarYGenerarSemifinalesMultiplesGrupos(partidoFinalizado, showToast);
    
    // 3. Verificar si es necesario generar final cuando se completan semifinales
    await verificarYGenerarFinalDesdeSemifinales(partidoFinalizado, showToast);
    
    if (showToast && typeof showToast === 'function') {
      showToast("✅ Partido finalizado. Se verificaron automáticamente todas las fases siguientes.", "info");
    }
    
    return true;
  } catch (error) {
    console.error("Error en verificación externa:", error);
    if (showToast && typeof showToast === 'function') {
      showToast("❌ Error al verificar fases automáticas", "error");
    }
    return false;
  }
};
