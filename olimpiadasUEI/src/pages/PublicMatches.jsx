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
import "../styles/AdminMatches.css";


export default function PublicMatches() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  
  // Funciones de navegación
  const goToDisciplineSelector = () => {
    navigate('/selector');
  };

  const goToLogin = () => {
    navigate('/');
  };
  
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
      grupos: partidosCategoria.some(m => m.fase === "grupos"),
      semifinal: partidosCategoria.some(m => m.fase === "semifinal" || m.fase === "semifinales"),
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
      return cumpleFiltros && match.fase === "grupos";
    } else if (faseActiva === "semifinal") {
      return cumpleFiltros && (match.fase === "semifinal" || match.fase === "semifinales");
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
        return cumpleFiltros && match.fase === "grupos";
      } else if (fase === "semifinal") {
        return cumpleFiltros && (match.fase === "semifinal" || match.fase === "semifinales");
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
    <div className="admin-matches">
      <div className="matches-header">
        <h1>Partidos - {discipline.charAt(0).toUpperCase() + discipline.slice(1)}</h1>
        <div className="header-actions">
          <button 
            onClick={goToDisciplineSelector}
            className="nav-btn secondary"
          >
            📋 Disciplinas
          </button>
          <button 
            onClick={goToLogin}
            className="nav-btn primary"
          >
            🚪 Salir
          </button>
        </div>
      </div>

      
      {/* Contenedor de filtros */}
      <div className="filters-container">
        <h3>📊 Filtros:</h3>
        
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
        
        {/* Botón para limpiar filtros */}
        <div className="filters-actions">
          <button onClick={limpiarFiltros} className="btn-limpiar-filtros">
            🧹 Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Navegación por fases */}
      {filtroGenero && filtroNivelEducacional && filtroCategoria && (
        <div className="phase-navigation">
          <div className="phase-buttons">
            {(() => {
              const fasesExistentes = verificarFasesExistentes();
              const botonesFases = [];

              if (fasesExistentes.grupos) {
                const countGrupos = matches.filter(match => 
                  match.genero === filtroGenero &&
                  match.nivelEducacional === filtroNivelEducacional &&
                  match.categoria === filtroCategoria &&
                  match.fase === "grupos"
                ).length;
                botonesFases.push({
                  key: "grupos",
                  label: "👥 FASE DE GRUPOS",
                  count: countGrupos
                });
              }

              if (fasesExistentes.semifinal) {
                const countSemifinal = matches.filter(match => 
                  match.genero === filtroGenero &&
                  match.nivelEducacional === filtroNivelEducacional &&
                  match.categoria === filtroCategoria &&
                  match.fase === "semifinal"
                ).length;
                botonesFases.push({
                  key: "semifinal",
                  label: "🏆 SEMIFINALES",
                  count: countSemifinal
                });
              }

              if (fasesExistentes.final) {
                const countFinal = matches.filter(match => 
                  match.genero === filtroGenero &&
                  match.nivelEducacional === filtroNivelEducacional &&
                  match.categoria === filtroCategoria &&
                  (match.fase === "final" || match.fase === "tercer_puesto" || match.fase === "tercerPuesto")
                ).length;
                botonesFases.push({
                  key: "final",
                  label: "🥇 FINALES",
                  count: countFinal
                });
              }

              if (fasesExistentes.ida_vuelta) {
                const countIdaVuelta = matches.filter(match => 
                  match.genero === filtroGenero &&
                  match.nivelEducacional === filtroNivelEducacional &&
                  match.categoria === filtroCategoria &&
                  (match.fase === "ida" || match.fase === "vuelta" || match.fase === "desempate")
                ).length;
                botonesFases.push({
                  key: "ida_vuelta",
                  label: "🔄 IDA Y VUELTA",
                  count: countIdaVuelta
                });
              }

              // Agregar botón "Todas las fases" si hay más de una fase
              if (botonesFases.length > 1) {
                const totalPartidos = matches.filter(match => 
                  match.genero === filtroGenero &&
                  match.nivelEducacional === filtroNivelEducacional &&
                  match.categoria === filtroCategoria
                ).length;
                botonesFases.push({
                  key: "todas",
                  label: "📊 TODAS LAS FASES",
                  count: totalPartidos
                });
              }

              return botonesFases.map(fase => (
                <button
                  key={fase.key}
                  className={`phase-btn ${faseActiva === fase.key ? 'active' : ''}`}
                  onClick={() => setFaseActiva(fase.key)}
                >
                  {fase.label} ({fase.count})
                </button>
              ));
            })()}
          </div>
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
                      <div key={match.id} className="partido-card" onClick={() => handleMatchClick(match)}>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMatchClick(match);
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            Ver Detalles
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
