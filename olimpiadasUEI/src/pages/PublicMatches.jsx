import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/PublicMatches.css";

export default function PublicMatches() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  
  // Estados principales
  const [matches, setMatches] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para filtros con persistencia
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_filtro_nivel_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_filtro_categoria_${discipline}`) || "";
  });

  // Estados para opciones de filtros (extraídos dinámicamente de los equipos)
  const [opcionesGenero, setOpcionesGenero] = useState([]);
  const [opcionesNivel, setOpcionesNivel] = useState([]);
  const [opcionesCategorias, setOpcionesCategorias] = useState([]);

  // Estados para navegación por fases
  const [faseActiva, setFaseActiva] = useState("grupos");

  // ==================== FUNCIONES DE FILTROS ====================
  
  // Guardar filtros en localStorage
  const guardarFiltros = (genero, nivel, categoria) => {
    localStorage.setItem(`olimpiadas_public_filtro_genero_${discipline}`, genero);
    localStorage.setItem(`olimpiadas_public_filtro_nivel_${discipline}`, nivel);
    localStorage.setItem(`olimpiadas_public_filtro_categoria_${discipline}`, categoria);
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

        console.log('📊 Datos públicos cargados:', {
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
      
      console.log(`🔄 Partidos públicos actualizados: ${matchesData.length}`);
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

  // ==================== FILTROS PARA MOSTRAR DATOS (igual que ProfesorMatches) ====================

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

  // Agrupar partidos por grupo (usando el campo grupo - igual que ProfesorMatches)
  const agruparPorGrupo = (matches) => {
    const agrupados = {};
    matches.forEach((match) => {
      const grupoAsignado = match.grupo || "Sin grupo";
      if (!agrupados[grupoAsignado]) agrupados[grupoAsignado] = [];
      agrupados[grupoAsignado].push(match);
    });
    return agrupados;
  };

  // Agrupar partidos filtrados por grupo
  const partidosAgrupados = agruparPorGrupo(partidosFiltrados);

  // Contar partidos por fase (igual que ProfesorMatches)
  const contarPartidosPorFase = (fase) => {
    return matches.filter(match => {
      // Aplicar filtros con flexibilidad para desempates
      const esDesempate = match.fase === "desempate";
      let cumpleFiltros;
      
      if (esDesempate) {
        // Para desempates, ser más flexible
        const equipoACampos = match.equipoA || {};
        const equipoBCampos = match.equipoB || {};
        
        cumpleFiltros = (!filtroGenero || match.genero === filtroGenero || 
                        equipoACampos.genero === filtroGenero || 
                        equipoBCampos.genero === filtroGenero) &&
                       (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional || 
                        equipoACampos.nivelEducacional === filtroNivelEducacional || 
                        equipoBCampos.nivelEducacional === filtroNivelEducacional) &&
                       (!filtroCategoria || match.categoria === filtroCategoria || 
                        equipoACampos.categoria === filtroCategoria || 
                        equipoBCampos.categoria === filtroCategoria);
      } else {
        // Para partidos normales
        cumpleFiltros = (!filtroGenero || match.genero === filtroGenero) &&
                       (!filtroNivelEducacional || match.nivelEducacional === filtroNivelEducacional) &&
                       (!filtroCategoria || match.categoria === filtroCategoria);
      }
      
      if (fase === "grupos") {
        return cumpleFiltros && (match.fase === "grupos" || !match.fase);
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

  // Obtener opciones de niveles educacionales disponibles según el género seleccionado
  const getNivelesDisponibles = () => {
    if (!filtroGenero) return [];
    return [...new Set(equipos
      .filter(equipo => equipo.genero === filtroGenero)
      .map(equipo => equipo.nivelEducacional)
      .filter(Boolean)
    )];
  };

  // Obtener opciones de categorías disponibles según género y nivel seleccionados
  const getCategoriasDisponibles = () => {
    if (!filtroGenero || !filtroNivelEducacional) return [];
    return [...new Set(equipos
      .filter(equipo => 
        equipo.genero === filtroGenero && 
        equipo.nivelEducacional === filtroNivelEducacional
      )
      .map(equipo => equipo.categoria)
      .filter(Boolean)
    )];
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
      texto += `Ida y Vuelta (${partidosIdaVuelta.length})`;
    } else if (desempate > 0) {
      texto += `Desempate (${partidosIdaVuelta.length})`;
    } else if (ida > 0) {
      texto += `Ida (${partidosIdaVuelta.length})`;
    } else if (vuelta > 0) {
      texto += `Vuelta (${partidosIdaVuelta.length})`;
    } else {
      texto += `Ida/Vuelta (${partidosIdaVuelta.length})`;
    }
    
    return texto;
  };

  // Función para ir al detalle del partido (solo visualización)
  const irADetallePartido = (partidoId) => {
    navigate(`/public/${discipline}/match/${partidoId}`);
  };

  // Función para formatear fecha y hora
  const formatearFechaHora = (fecha, hora) => {
    if (!fecha && !hora) return "Por programar";
    if (fecha && hora) return `${fecha} - ${hora}`;
    if (fecha) return fecha;
    if (hora) return hora;
    return "Sin definir";
  };

  // Función para obtener la clase CSS del estado del partido
  const getStatusClass = (estado) => {
    switch (estado) {
      case "finalizado":
        return "finalizado";
      case "en curso":
        return "en-curso";
      case "pendiente":
        return "pendiente";
      case "programado":
        return "programado";
      default:
        return "pendiente";
    }
  };

  // Función para obtener el texto del estado del partido
  const getStatusText = (estado) => {
    switch (estado) {
      case "finalizado":
        return "✅ Finalizado";
      case "en curso":
        return "🟢 En Curso";
      case "pendiente":
        return "⏳ Pendiente";
      case "programado":
        return "📅 Programado";
      default:
        return "⏳ Pendiente";
    }
  };

  // Función para manejar clic en partido (navegar al detalle)
  const handleMatchClick = (partido) => {
    navigate(`/public/${discipline}/match/${partido.id}`);
  };

  // Funciones de navegación de fases
  const fasesDisponibles = ["grupos", "semifinal", "final", "ida_vuelta"];

  const canNavigateBack = () => {
    const currentIndex = fasesDisponibles.indexOf(faseActiva);
    return currentIndex > 0;
  };

  const canNavigateForward = () => {
    const currentIndex = fasesDisponibles.indexOf(faseActiva);
    return currentIndex < fasesDisponibles.length - 1;
  };

  const navigateToPreviousPhase = () => {
    const currentIndex = fasesDisponibles.indexOf(faseActiva);
    if (currentIndex > 0) {
      setFaseActiva(fasesDisponibles[currentIndex - 1]);
    }
  };

  const navigateToNextPhase = () => {
    const currentIndex = fasesDisponibles.indexOf(faseActiva);
    if (currentIndex < fasesDisponibles.length - 1) {
      setFaseActiva(fasesDisponibles[currentIndex + 1]);
    }
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    setFaseActiva("grupos");
    
    // Limpiar localStorage
    localStorage.removeItem(`olimpiadas_public_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_filtro_nivel_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_filtro_categoria_${discipline}`);
  };

  // ==================== RENDER ====================
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando partidos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  // Filtrar opciones dependientes
  const nivelesDisponibles = getNivelesDisponibles();
  const categoriasDisponibles = getCategoriasDisponibles();

  return (
    <div className="public-matches-container">
      {/* Header */}
      <div className="public-header">
        <div className="public-header-icon">
          {discipline === "futbol" ? "⚽" : discipline === "basquet" ? "🏀" : "🏐"}
        </div>
        <h1 className="public-title">
          Partidos de {discipline === "futbol" ? "Fútbol" : discipline === "basquet" ? "Básquet" : "Vóley"}
        </h1>
        <p className="public-subtitle">Seguimiento en tiempo real</p>
      </div>

      {/* Navegación de fases y filtros */}
      <div className="public-phase-navigation">
        {/* Controles de navegación de fases */}
        <div className="public-phase-controls">
          <button 
            className={`public-phase-btn ${!canNavigateBack() ? 'disabled' : ''}`}
            onClick={navigateToPreviousPhase}
            disabled={!canNavigateBack()}
          >
            <span className="public-btn-icon">←</span>
          </button>
          
          <div className="public-current-phase">
            <span className="public-phase-icon">
              {faseActiva === "grupos" && "👥"}
              {faseActiva === "semifinal" && "🏆"}
              {faseActiva === "final" && "🥇"}
              {faseActiva === "ida_vuelta" && "🔄"}
              {faseActiva === "todas" && "🏟️"}
            </span>
            <h2 className="public-phase-title">
              {faseActiva === "grupos" && "Fase de Grupos"}
              {faseActiva === "semifinal" && "Semifinales"}
              {faseActiva === "final" && "Finales"}
              {faseActiva === "ida_vuelta" && "Ida/Vuelta"}
              {faseActiva === "todas" && "Todas las Fases"}
            </h2>
          </div>
          
          <button 
            className={`public-phase-btn ${!canNavigateForward() ? 'disabled' : ''}`}
            onClick={navigateToNextPhase}
            disabled={!canNavigateForward()}
          >
            <span className="public-btn-icon">→</span>
          </button>
        </div>

        {/* Controles de filtros */}
        <div className="filter-controls">
          <div className="filters-row">
            {/* Filtro de Género */}
            <div className="filter-group">
              <label className="filter-label">
                <span>🚻</span>
                Género:
              </label>
              <select
                value={filtroGenero}
                onChange={(e) => handleFiltroGeneroChange(e.target.value)}
                className="modern-select"
              >
                <option value="">Todos los géneros</option>
                {opcionesGenero.map(genero => (
                  <option key={genero} value={genero}>{genero}</option>
                ))}
              </select>
            </div>

            {/* Filtro de Nivel Educacional */}
            <div className="filter-group">
              <label className="filter-label">
                <span>🎓</span>
                Nivel:
              </label>
              <select
                value={filtroNivelEducacional}
                onChange={(e) => handleFiltroNivelEducacionalChange(e.target.value)}
                className="modern-select"
                disabled={!filtroGenero}
              >
                <option value="">Todos los niveles</option>
                {nivelesDisponibles.map(nivel => (
                  <option key={nivel} value={nivel}>{nivel}</option>
                ))}
              </select>
            </div>

            {/* Filtro de Categoría */}
            <div className="filter-group">
              <label className="filter-label">
                <span>🏆</span>
                Categoría:
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
                className="modern-select"
                disabled={!filtroGenero || !filtroNivelEducacional}
              >
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map(categoria => (
                  <option key={categoria} value={categoria}>{categoria}</option>
                ))}
              </select>
            </div>

            {/* Botón limpiar */}
            <div className="filter-group">
              <label className="filter-label" style={{ opacity: 0 }}>Acciones:</label>
              <button onClick={limpiarFiltros} className="clear-filters-btn">
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de partidos */}
      <div className="public-matches-section">
        {/* Mostrar partidos o estado vacío */}
        {partidosFiltrados.length === 0 ? (
          <div className="public-empty-state">
            <div className="public-empty-icon">📋</div>
            <h3>No hay partidos disponibles</h3>
            <p>
              {!filtroGenero || !filtroNivelEducacional || !filtroCategoria 
                ? "Selecciona todos los filtros para ver los partidos"
                : "No hay partidos programados para esta categoría y fase"
              }
            </p>
            {(filtroGenero || filtroNivelEducacional || filtroCategoria) && (
              <button onClick={limpiarFiltros} className="clear-filters-empty-btn">
                Limpiar Filtros
              </button>
            )}
          </div>
        ) : (
          // Renderizar partidos agrupados
          Object.entries(partidosAgrupados).map(([grupo, partidos]) => (
            <div key={grupo} className="public-match-group">
              <h3 className="public-group-title">
                {grupo} ({partidos.length} {partidos.length === 1 ? 'partido' : 'partidos'})
              </h3>
              <div className="public-matches-grid">
                {partidos.map((partido) => {
                  // Usar la misma estructura que ProfesorMatches
                  const equipoA = partido.equipoA ? `${partido.equipoA.curso} ${partido.equipoA.paralelo}` : "Equipo A";
                  const equipoB = partido.equipoB ? `${partido.equipoB.curso} ${partido.equipoB.paralelo}` : "Equipo B";

                  return (
                    <div 
                      key={partido.id} 
                      className="public-match-card"
                      onClick={() => handleMatchClick(partido)}
                    >
                      {/* Teams */}
                      <div className="public-match-teams">
                        <div className="public-team">
                          <span className="public-team-name">{equipoA}</span>
                        </div>
                        <div className="public-vs">VS</div>
                        <div className="public-team">
                          <span className="public-team-name">{equipoB}</span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="public-match-score">
                        <div className="public-score-display">
                          <span className="public-score-number">
                            {partido.marcadorA !== undefined ? partido.marcadorA : '-'}
                          </span>
                          <span className="public-score-separator">:</span>
                          <span className="public-score-number">
                            {partido.marcadorB !== undefined ? partido.marcadorB : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="public-match-status">
                        <span className={`public-status-badge ${getStatusClass(partido.estado)}`}>
                          {getStatusText(partido.estado)}
                        </span>
                      </div>

                      {/* Schedule */}
                      {(partido.fechaHora || partido.hora || partido.fecha) && (
                        <div className="public-match-schedule">
                          <span className="public-schedule-text">
                            {partido.fechaHora ? 
                              new Date(partido.fechaHora.seconds * 1000).toLocaleString() : 
                              formatearFechaHora(partido.fecha, partido.hora)
                            }
                          </span>
                        </div>
                      )}

                      {/* Details */}
                      <div className="public-match-details">
                        <span className="public-match-category">
                          {partido.categoria} - {partido.fase || "Fase de Grupos"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
