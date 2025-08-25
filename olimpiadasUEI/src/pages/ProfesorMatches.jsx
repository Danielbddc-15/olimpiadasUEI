import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "../styles/ProfesorMatches.css";

export default function ProfesorMatches() {
  const { discipline } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados básicos
  const [matches, setMatches] = useState([]);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editedMatch, setEditedMatch] = useState({ fecha: "", hora: "" });
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Estados para filtros con persistencia
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_profesor_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_profesor_filtro_nivel_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_profesor_filtro_categoria_${discipline}`) || "";
  });
  
  // Estados para opciones de filtros (extraídos dinámicamente de los equipos)
  const [opcionesGenero, setOpcionesGenero] = useState([]);
  const [opcionesNivel, setOpcionesNivel] = useState([]);
  const [opcionesCategorias, setOpcionesCategorias] = useState([]);

  // Estados para navegación por fases (copiado desde AdminMatches)
  const [faseActiva, setFaseActiva] = useState("todas");

  // ==================== FILTROS PARA MOSTRAR DATOS (igual que AdminMatches) ====================

  // Filtrar partidos según los filtros activos y fase
  const partidosFiltrados = matches.filter(match => {
    // Aplicar filtros de manera más flexible para partidos de desempate
    let cumpleFiltros = true;
    
    // Para partidos de desempate, ser más flexible con los filtros
    const esDesempate = match.fase === "desempate";
    
    if (esDesempate) {
      // Para desempates, buscar en equipos relacionados si no tiene campos directos
      const equipoACampos = match.equipoA || {};
      const equipoBCampos = match.equipoB || {};
      
      // Si hay filtro de género, verificar en el partido o en los equipos
      if (filtroGenero) {
        const tieneGenero = match.genero === filtroGenero || 
                           equipoACampos.genero === filtroGenero || 
                           equipoBCampos.genero === filtroGenero;
        cumpleFiltros = cumpleFiltros && tieneGenero;
      }
      
      // Si hay filtro de nivel, verificar en el partido o en los equipos
      if (filtroNivelEducacional) {
        const tieneNivel = match.nivelEducacional === filtroNivelEducacional || 
                          equipoACampos.nivelEducacional === filtroNivelEducacional || 
                          equipoBCampos.nivelEducacional === filtroNivelEducacional;
        cumpleFiltros = cumpleFiltros && tieneNivel;
      }
      
      // Si hay filtro de categoría, verificar en el partido o en los equipos
      if (filtroCategoria) {
        const tieneCategoria = match.categoria === filtroCategoria || 
                              equipoACampos.categoria === filtroCategoria || 
                              equipoBCampos.categoria === filtroCategoria;
        cumpleFiltros = cumpleFiltros && tieneCategoria;
      }
    } else {
      // Para partidos normales, aplicar filtros estrictos
      // Si hay filtro de género, el partido DEBE tener ese género exacto
      if (filtroGenero) {
        cumpleFiltros = cumpleFiltros && (match.genero === filtroGenero);
      }
      
      // Si hay filtro de nivel, el partido DEBE tener ese nivel exacto
      if (filtroNivelEducacional) {
        cumpleFiltros = cumpleFiltros && (match.nivelEducacional === filtroNivelEducacional);
      }
      
      // Si hay filtro de categoría, el partido DEBE tener esa categoría exacta
      if (filtroCategoria) {
        cumpleFiltros = cumpleFiltros && (match.categoria === filtroCategoria);
      }
    }
    
    // Filtrar por fase activa
    if (faseActiva === "grupos") {
      return cumpleFiltros && match.fase === "grupos";
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
      // Aplicar filtros con flexibilidad para desempates
      const esDesempate = match.fase === "desempate";
      let cumpleFiltros = true;
      
      if (esDesempate) {
        // Para desempates, ser más flexible
        const equipoACampos = match.equipoA || {};
        const equipoBCampos = match.equipoB || {};
        
        if (filtroGenero) {
          const tieneGenero = match.genero === filtroGenero || 
                             equipoACampos.genero === filtroGenero || 
                             equipoBCampos.genero === filtroGenero;
          cumpleFiltros = cumpleFiltros && tieneGenero;
        }
        
        if (filtroNivelEducacional) {
          const tieneNivel = match.nivelEducacional === filtroNivelEducacional || 
                            equipoACampos.nivelEducacional === filtroNivelEducacional || 
                            equipoBCampos.nivelEducacional === filtroNivelEducacional;
          cumpleFiltros = cumpleFiltros && tieneNivel;
        }
        
        if (filtroCategoria) {
          const tieneCategoria = match.categoria === filtroCategoria || 
                                equipoACampos.categoria === filtroCategoria || 
                                equipoBCampos.categoria === filtroCategoria;
          cumpleFiltros = cumpleFiltros && tieneCategoria;
        }
      } else {
        // Para partidos normales, filtros estrictos
        cumpleFiltros = (!filtroGenero || match.genero === filtroGenero) &&
                       (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional) &&
                       (!filtroCategoria || match.categoria === filtroCategoria);
      }
      
      if (fase === "grupos") {
        return cumpleFiltros && match.fase === "grupos";
      } else if (fase === "semifinal") {
        return cumpleFiltros && match.fase === "semifinal";
      } else if (fase === "final") {
        return cumpleFiltros && (match.fase === "final" || match.fase === "tercer_puesto" || match.fase === "tercerPuesto");
      } else if (fase === "ida_vuelta") {
        return cumpleFiltros && (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate");
      }
      return false;
    }).length;
  };

  // ==================== FUNCIONES DE FILTROS ====================
  const irADetallePartido = (matchId) => {
    // Redireccionar según la disciplina
    if (discipline === "voley") {
      navigate(`/profesor-voley-match-detail/${matchId}`);
    } else if (discipline === "basquet") {
      navigate(`/profesor-basquet-match-detail/${matchId}`);
    } else {
      navigate(`/profesor-match-detail/${matchId}`);
    }
  };

  // Funciones de navegación
  const goToStandings = () => {
    navigate(`/profesor/${discipline}/tabla`);
  };

  const goToSchedule = () => {
    navigate(`/profesor/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/profesor');
  };

  // ==================== FUNCIONES DE FILTROS ====================
  
  // ==================== FUNCIONES DE FILTROS ====================
  
  // Guardar filtros en localStorage
  const guardarFiltros = (genero, nivel, categoria) => {
    localStorage.setItem(`olimpiadas_profesor_filtro_genero_${discipline}`, genero);
    localStorage.setItem(`olimpiadas_profesor_filtro_nivel_${discipline}`, nivel);
    localStorage.setItem(`olimpiadas_profesor_filtro_categoria_${discipline}`, categoria);
  };

  // Manejar cambio de género
  const handleFiltroGeneroChange = (value) => {
    setFiltroGenero(value);
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    guardarFiltros(value, "", "");
  };

  // Manejar cambio de nivel educacional
  const handleFiltroNivelEducacionalChange = (value) => {
    setFiltroNivelEducacional(value);
    setFiltroCategoria("");
    guardarFiltros(filtroGenero, value, "");
  };

  // Manejar cambio de categoría
  const handleFiltroCategoriaChange = (value) => {
    setFiltroCategoria(value);
    guardarFiltros(filtroGenero, filtroNivelEducacional, value);
  };

  // Obtener opciones de niveles educacionales disponibles según el género seleccionado
  const getNivelesDisponibles = () => {
    if (!filtroGenero) return [];
    return [...new Set(categorias
      .filter(categoria => categoria.genero === filtroGenero)
      .map(categoria => categoria.nivelEducacional)
      .filter(Boolean)
    )];
  };

  // Obtener opciones de categorías disponibles según género y nivel seleccionados
  const getCategoriasDisponibles = () => {
    if (!filtroGenero || !filtroNivelEducacional) return [];
    return [...new Set(categorias
      .filter(categoria => 
        categoria.genero === filtroGenero && 
        categoria.nivelEducacional === filtroNivelEducacional
      )
      .map(categoria => categoria.nombre)
      .filter(Boolean)
    )];
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

  // Detectar si es fútbol
  const esFutbol = discipline === "futbol";

  // Fases según disciplina - ACTUALIZADO PARA VÓLEY
  const fasesDb = {
    grupos1: "Fase de Grupos 1",
    grupos3: "Fase de Grupos 3",
    semifinales: "Semifinales",
    finales: "Finales",
  };

  // Arrays para la navegación
  const fases = Object.values(fasesDb);
  const fasesArray = Object.keys(fasesDb);

  // Función para obtener el icono de la fase
  const obtenerIconoFase = (faseKey) => {
    if (faseKey.includes("grupos")) return "👥";
    if (faseKey === "semifinales") return "🥈";
    if (faseKey === "finales") return "🏆";
    return "🏅";
  };

  // Función para calcular clasificación por grupo
  const calcularClasificacion = (partidosGrupo) => {
    const equipos = {};
    
    partidosGrupo.forEach((match) => {
      if (match.estado !== "finalizado") return;
      
      const equipoAKey = `${match.equipoA.curso} ${match.equipoA.paralelo}`;
      const equipoBKey = `${match.equipoB.curso} ${match.equipoB.paralelo}`;
      
      if (!equipos[equipoAKey]) {
        equipos[equipoAKey] = {
          nombre: equipoAKey,
          curso: match.equipoA.curso,
          paralelo: match.equipoA.paralelo,
          grupo: match.grupo,
          partidos: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          puntosAFavor: 0,
          puntosEnContra: 0,
          puntos: 0
        };
      }
      
      if (!equipos[equipoBKey]) {
        equipos[equipoBKey] = {
          nombre: equipoBKey,
          curso: match.equipoB.curso,
          paralelo: match.equipoB.paralelo,
          grupo: match.grupo,
          partidos: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          puntosAFavor: 0,
          puntosEnContra: 0,
          puntos: 0
        };
      }
      
      const marcadorA = match.marcadorA || 0;
      const marcadorB = match.marcadorB || 0;
      
      equipos[equipoAKey].partidos++;
      equipos[equipoBKey].partidos++;
      equipos[equipoAKey].puntosAFavor += marcadorA;
      equipos[equipoAKey].puntosEnContra += marcadorB;
      equipos[equipoBKey].puntosAFavor += marcadorB;
      equipos[equipoBKey].puntosEnContra += marcadorA;
      
      if (marcadorA > marcadorB) {
        // Equipo A gana
        equipos[equipoAKey].ganados++;
        equipos[equipoAKey].puntos += 3;
        equipos[equipoBKey].perdidos++;
      } else if (marcadorA < marcadorB) {
        // Equipo B gana
        equipos[equipoBKey].ganados++;
        equipos[equipoBKey].puntos += 3;
        equipos[equipoAKey].perdidos++;
      } else {
        // Empate
        equipos[equipoAKey].empatados++;
        equipos[equipoAKey].puntos += 1;
        equipos[equipoBKey].empatados++;
        equipos[equipoBKey].puntos += 1;
      }
    });
    
    // Ordenar según la disciplina
    if (discipline === "voley") {
      // Para vóley: 1) Partidos ganados, 2) Menos puntos en contra
      return Object.values(equipos).sort((a, b) => {
        if (b.ganados !== a.ganados) return b.ganados - a.ganados;
        return a.puntosEnContra - b.puntosEnContra;
      });
    } else {
      // Para fútbol: 1) Puntos, 2) Partidos ganados, 3) Menos puntos en contra
      return Object.values(equipos).sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.ganados !== a.ganados) return b.ganados - a.ganados;
        return a.puntosEnContra - b.puntosEnContra;
      });
    }
  };

  // Función para verificar si una fase está completa
  const verificarFaseCompleta = (fase) => {
    const partidosFase = matches.filter(m => (m.fase || "grupos1") === fase && m.estado === "finalizado");
    
    if (partidosFase.length === 0) return false;
    
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

  // Función para generar partidos de la siguiente fase automáticamente
  const generarSiguienteFase = async (faseActual) => {
    if (faseActual === "finales") return; // No hay fase después de finales
    
    const fasesSiguientes = {
      "grupos1": "grupos2",
      "grupos2": "grupos3", 
      "grupos3": "semifinales",
      "semifinales": "finales"
    };
    
    const siguienteFase = fasesSiguientes[faseActual];
    if (!siguienteFase) return;
    
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

  // Obtener grupos desde Firestore
  useEffect(() => {
    const obtenerGrupos = async () => {
      const snapshot = await getDocs(collection(db, "grupos"));
      const data = snapshot.docs.map((doc) => doc.data().nombre);
      setGrupos(data);
    };
    obtenerGrupos();
  }, []);

  // Obtener categorías desde Firestore para los filtros
  useEffect(() => {
    const obtenerCategorias = async () => {
      try {
        const q = query(
          collection(db, "categorias"),
          where("disciplina", "==", discipline),
        );
        const snapshot = await getDocs(q);
        const categoriasData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Guardar categorías en el estado
        setCategorias(categoriasData);

        // Extraer opciones únicas para filtros desde categorías
        const generos = [...new Set(categoriasData.map(c => c.genero).filter(Boolean))];
        const niveles = [...new Set(categoriasData.map(c => c.nivelEducacional).filter(Boolean))];
        const categorias = [...new Set(categoriasData.map(c => c.nombre).filter(Boolean))];

        setOpcionesGenero(generos);
        setOpcionesNivel(niveles);
        setOpcionesCategorias(categorias);

        console.log('📊 Categorías cargadas en Profesor:', {
          totalCategorias: categoriasData.length,
          generos,
          niveles,
          categorias
        });

      } catch (error) {
        console.error("Error al cargar categorías:", error);
      }
    };

    // También obtener equipos para el funcionamiento normal del componente
    const obtenerEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline),
        );
        const snapshot = await getDocs(q);
        const equiposData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setEquipos(equiposData);

        console.log('📊 Equipos cargados en Profesor:', {
          equipos: equiposData.length
        });

      } catch (error) {
        console.error("Error al cargar equipos:", error);
      }
    };

    obtenerCategorias();
    obtenerEquipos();
  }, [discipline]);

  // Obtener partidos en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Completar campos faltantes en partidos de desempate
      const partidosCompletos = completarCamposDesempate(data);
      
      setMatches(partidosCompletos);
    });
    return () => unsubscribe();
  }, [discipline]);

  // Función para verificar si un profesor puede iniciar un partido (ahora sin restricciones)
  const puedeProfesorIniciarPartido = (match) => {
    const userRole = localStorage.getItem('userRole');
    
    // Tanto admin como profesor pueden iniciar cualquier partido
    if (userRole === 'admin' || userRole === 'profesor') {
      return { puede: true, motivo: 'autorizado' };
    }
    
    // Para otros roles (no debería pasar), aplicar restricciones
    if (!match.fecha || !match.hora) {
      return { 
        puede: false, 
        motivo: 'sin_horario',
        mensaje: 'Sin fecha/hora programada' 
      };
    }
    
    return { puede: true, motivo: 'puede_iniciar' };
  };

  // Función para completar campos faltantes en partidos de desempate
  const completarCamposDesempate = (partidos) => {
    return partidos.map(partido => {
      if (partido.fase === "desempate" && (!partido.genero || !partido.nivelEducacional || !partido.categoria)) {
        // Buscar partidos relacionados en el mismo grupo para heredar campos
        const partidosRelacionados = partidos.filter(p => 
          p.grupo === partido.grupo && 
          p.fase !== "desempate" &&
          (p.genero || p.nivelEducacional || p.categoria)
        );
        
        if (partidosRelacionados.length > 0) {
          const partidoReferencia = partidosRelacionados[0];
          console.log(`🔧 Completando campos para desempate en grupo ${partido.grupo}:`, {
            original: { genero: partido.genero, nivel: partido.nivelEducacional, categoria: partido.categoria },
            heredado: { genero: partidoReferencia.genero, nivel: partidoReferencia.nivelEducacional, categoria: partidoReferencia.categoria }
          });
          
          return {
            ...partido,
            genero: partido.genero || partidoReferencia.genero,
            nivelEducacional: partido.nivelEducacional || partidoReferencia.nivelEducacional,
            categoria: partido.categoria || partidoReferencia.categoria
          };
        }
      }
      return partido;
    });
  };

  // Auto-generación de siguientes fases cuando se completa una fase
  useEffect(() => {
    if (!matches.length || !grupos.length) return;
    
    const verificarYGenerar = async () => {
      // Verificar cada fase para auto-generar la siguiente
      const fasesParaVerificar = ["grupos1", "grupos2", "grupos3", "semifinales"];
      
      for (const fase of fasesParaVerificar) {
        if (verificarFaseCompleta(fase)) {
          await generarSiguienteFase(fase);
        }
      }
    };
    
    verificarYGenerar();
  }, [matches, grupos, discipline]);

  // Agrupar partidos por grupo (usando el campo grupo)
  const agruparPorGrupo = (matches) => {
    const agrupados = {};
    matches.forEach((match) => {
      const grupoAsignado = match.grupo || "Sin grupo";
      if (!agrupados[grupoAsignado]) agrupados[grupoAsignado] = [];
      agrupados[grupoAsignado].push(match);
    });
    return agrupados;
  };

  // Handlers
  const handleEdit = (match) => {
    setEditingMatchId(match.id);
    setEditedMatch({ fecha: match.fecha || "", hora: match.hora || "" });
  };

  const handleSaveEdit = async (id) => {
    await updateDoc(doc(db, "matches", id), {
      fecha: editedMatch.fecha || null,
      hora: editedMatch.hora || null,
    });
    setEditingMatchId(null);
  };

  // Botón Gol con nombre desde modal
  const handleGol = async (id, equipo, nombre) => {
    if (!nombre) return;
    const matchRef = doc(db, "matches", id);
    const matchDoc = matches.find((m) => m.id === id);
    let goleadoresA = matchDoc.goleadoresA || [];
    let goleadoresB = matchDoc.goleadoresB || [];
    let marcadorA = matchDoc.marcadorA || 0;
    let marcadorB = matchDoc.marcadorB || 0;

    if (equipo === "A") {
      goleadoresA = [...goleadoresA, nombre];
      marcadorA += 1;
    } else {
      goleadoresB = [...goleadoresB, nombre];
      marcadorB += 1;
    }

    await updateDoc(matchRef, {
      marcadorA,
      marcadorB,
      goleadoresA,
      goleadoresB,
    });
    // Actualiza el partido en el estado local
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, marcadorA, marcadorB, goleadoresA, goleadoresB }
          : m,
      ),
    );
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
    // Actualiza el partido en el estado local
    setMatches((prev) =>
      prev.map((m) =>
        m.id === editMatchId
          ? { ...m, goleadoresA: editGoleadoresA, goleadoresB: editGoleadoresB }
          : m,
      ),
    );
  };

  // Componente para mostrar las tarjetas de partidos de una fase
  function TablaPartidos({ partidos }) {
    const partidosPorGrupo = agruparPorGrupo(partidos);

    if (partidos.length === 0) {
      return (
        <div className="no-partidos">
          <div className="empty-icon">⚽</div>
          <h3>No hay partidos en esta fase</h3>
          <p>Los partidos aparecerán aquí cuando estén programados</p>
        </div>
      );
    }

    return (
      <div className="partidos-container">
        <div className="partidos-content">
          {Object.keys(partidosPorGrupo).map((grupo, index) => (
            <div key={`${grupo}-${index}-${partidosPorGrupo[grupo][0]?.categoria || 'default'}`} className="partidos-grupo">
              <h3 className="grupo-titulo">
                {grupo} ({partidosPorGrupo[grupo].length} {partidosPorGrupo[grupo].length === 1 ? 'partido' : 'partidos'})
              </h3>
              <div className="partidos-grid">
                  {partidosPorGrupo[grupo].map((match) => (
                    <div key={match.id} className="partido-card" onClick={() => irADetallePartido(match.id)}>
                      <div className="partido-header">
                        <span className={`partido-fase ${
                          match.fase === "finales" || match.fase === "final" ? "FINAL" :
                          match.fase === "semifinales" || match.fase === "semifinal" ? "SEMIFINAL" :
                          match.fase === "tercer_puesto" || match.fase === "tercerPuesto" ? "TERCERPUESTO" :
                          match.fase === "ida" ? "IDA" :
                          match.fase === "vuelta" ? "VUELTA" :
                          match.fase === "desempate" ? "DESEMPATE" :
                          "GRUPOS"
                        }`}>
                          {match.fase === "finales" || match.fase === "final" ? "FINAL" :
                           match.fase === "semifinales" || match.fase === "semifinal" ? "SEMIFINAL" :
                           match.fase === "tercer_puesto" || match.fase === "tercerPuesto" ? "3ER PUESTO" :
                           match.fase === "ida" ? "IDA" :
                           match.fase === "vuelta" ? "VUELTA" :
                           match.fase === "desempate" ? "⚖️ DESEMPATE" :
                           match.fase === "grupos3" ? "FASE DE GRUPOS" :
                           match.fase === "grupos2" ? "FASE DE GRUPOS" :
                           "FASE DE GRUPOS"}
                        </span>
                        <span 
                          className={`partido-estado ${match.estado?.toUpperCase() || 'PENDIENTE'} ${
                            match.estado === 'pendiente' ? 
                              (puedeProfesorIniciarPartido(match).puede ? 'puede-iniciar' : 'no-puede-iniciar') 
                              : ''
                          }`}
                          data-tooltip={
                            match.estado === 'pendiente' && !puedeProfesorIniciarPartido(match).puede 
                              ? puedeProfesorIniciarPartido(match).mensaje 
                              : ''
                          }
                        >
                          {match.estado === "finalizado" ? "✅ FINALIZADO" :
                           match.estado === "en curso" ? "🟢 EN CURSO" :
                           match.estado === "pendiente" ? 
                             (puedeProfesorIniciarPartido(match).puede ? "🟡 LISTO PARA INICIAR" : "🔵 SIN PERMISOS") :
                           "⏳ PENDIENTE"}
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
                        {match.fecha || "Por definir"} {match.hora || ""}
                      </div>

                      <div className="partido-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            irADetallePartido(match.id);
                          }}
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  

  return (
    <div className="profesor-matches-container">
      {/* Header moderno para profesor */}
      <div className="profesor-header">
        <div className="header-icon">
          {discipline === "futbol"
            ? "⚽"
            : discipline === "voley"
              ? "🏐"
              : "🏀"}
        </div>
        <h1 className="profesor-title">Supervisión de Partidos</h1>
        <p className="profesor-subtitle">
          Monitorea y actualiza los encuentros de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Filtros modernos */}
      <div className="profesor-filters">
        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">👥</span>
              Género
            </label>
            <select
              value={filtroGenero}
              onChange={(e) => handleFiltroGeneroChange(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">🎓</span>
              Nivel Educacional
            </label>
            <select
              value={filtroNivelEducacional}
              onChange={(e) => handleFiltroNivelEducacionalChange(e.target.value)}
              className="filter-select"
              disabled={!filtroGenero}
            >
              <option value="">Seleccionar nivel</option>
              {getNivelesDisponibles().map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">🏆</span>
              Categoría
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
              className="filter-select"
              disabled={!filtroNivelEducacional}
            >
              <option value="">Seleccionar categoría</option>
              {getCategoriasDisponibles().map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          {(filtroGenero || filtroNivelEducacional || filtroCategoria) && (
            <button
              onClick={() => {
                setFiltroGenero("");
                setFiltroNivelEducacional("");
                setFiltroCategoria("");
                guardarFiltros("", "", "");
              }}
              className="filter-clear-btn"
              title="Limpiar filtros"
            >
              <span className="clear-icon">✕</span>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Navegación moderna entre secciones */}
      <div className="profesor-navigation">
        <Link
          to="/profesor"
          className="nav-link panel-link"
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Panel</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/partidos`}
          className={`nav-link ${location.pathname.includes("/partidos") ? "active" : ""}`}
        >
          <span className="nav-icon">⚽</span>
          <span className="nav-text">Partidos</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/tabla`}
          className={`nav-link ${location.pathname.includes("/tabla") ? "active" : ""}`}
        >
          <span className="nav-icon">🏆</span>
          <span className="nav-text">Posiciones</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/horarios`}
          className={`nav-link ${location.pathname.includes("/horarios") ? "active" : ""}`}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Horarios</span>
        </Link>
      </div>

      {/* Pestañas de fases (copiado de AdminMatches) */}
      {(filtroGenero && filtroNivelEducacional && filtroCategoria) && (
        <div className="phase-tabs">
          {contarPartidosPorFase("grupos") > 0 && (
            <button 
              className={`phase-tab grupos ${faseActiva === "grupos" ? "active" : ""}`}
              onClick={() => setFaseActiva("grupos")}
            >
              🏃‍♂️ Fase de Grupos ({contarPartidosPorFase("grupos")})
            </button>
          )}
          
          {contarPartidosPorFase("semifinal") > 0 && (
            <button 
              className={`phase-tab semifinales ${faseActiva === "semifinal" ? "active" : ""}`}
              onClick={() => setFaseActiva("semifinal")}
            >
              🔥 Semifinales ({contarPartidosPorFase("semifinal")})
            </button>
          )}
          
          {contarPartidosPorFase("final") > 0 && (
            <button 
              className={`phase-tab finales ${faseActiva === "final" ? "active" : ""}`}
              onClick={() => setFaseActiva("final")}
            >
              🏆 Finales ({contarPartidosPorFase("final")})
            </button>
          )}
          
          {contarPartidosPorFase("ida_vuelta") > 0 && (
            <button 
              className={`phase-tab ida-vuelta ${faseActiva === "ida_vuelta" ? "active" : ""}`}
              onClick={() => setFaseActiva("ida_vuelta")}
            >
              ⚽ Ida y Vuelta ({contarPartidosPorFase("ida_vuelta")})
            </button>
          )}
          
          <button 
            className={`phase-tab todas ${faseActiva === "todas" ? "active" : ""}`}
            onClick={() => setFaseActiva("todas")}
          >
            📋 Todas las Fases ({partidosFiltrados.length})
          </button>
        </div>
      )}

      {/* Contenedor de partidos */}
      <div className="matches-table-section">
        <TablaPartidos partidos={partidosFiltrados} />
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
    </div>
  );
}
