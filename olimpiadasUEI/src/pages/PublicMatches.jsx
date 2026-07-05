import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from "../api/firestoreCompat";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/PublicTournament.css";
import "../styles/PublicMatches.css";


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
  const [categorias, setCategorias] = useState([]);
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
  
  // Cargar categorías y opciones de filtros desde Firestore
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const q = query(
          collection(db, "categorias"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const categoriasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategorias(categoriasData);

        // Extraer opciones únicas para filtros desde categorías
        const generos = [...new Set(categoriasData.map(c => c.genero).filter(Boolean))];
        const niveles = [...new Set(categoriasData.map(c => c.nivelEducacional).filter(Boolean))];
        const cats = [...new Set(categoriasData.map(c => c.nombre).filter(Boolean))];

        setOpcionesGenero(generos);
        setOpcionesNivel(niveles);
        setOpcionesCategorias(cats);

        console.log('📊 Categorías públicas cargadas:', {
          total: categoriasData.length,
          generos,
          niveles,
          categorias: cats
        });
      } catch (error) {
        console.error("Error al cargar categorías públicas:", error);
      }
    };

    cargarCategorias();
  }, [discipline]);

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
      
      // Si la fase actual no existe o es "todas", cambiar a la primera disponible
      if (!fasesDisponibles[faseActiva] || faseActiva === "todas") {
        const primeraFaseDisponible = Object.keys(fasesDisponibles).find(fase => fasesDisponibles[fase]);
        if (primeraFaseDisponible) {
          setFaseActiva(primeraFaseDisponible);
        } else {
          setFaseActiva("grupos");
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
    return [...new Set(categorias
      .filter(c => c.genero === filtroGenero)
      .map(c => c.nivelEducacional)
      .filter(Boolean)
    )];
  };

  // Obtener opciones de categorías disponibles según género y nivel seleccionados
  const getCategoriasDisponibles = () => {
    if (!filtroGenero || !filtroNivelEducacional) return [];
    return [...new Set(categorias
      .filter(c => c.genero === filtroGenero && c.nivelEducacional === filtroNivelEducacional)
      .map(c => c.nombre)
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
    // Use specific routes for each discipline
    const detailRoutes = {
      'futbol': `/public/${discipline}/match/${partidoId}`,
      'voley': `/public-voley-match-detail/${partidoId}`,
      'basquet': `/public-basquet-match-detail/${partidoId}`
    };
    
    const route = detailRoutes[discipline] || `/public/${discipline}/match/${partidoId}`;
    navigate(route);
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
    // Use specific routes for each discipline
    const detailRoutes = {
      'futbol': `/public/${discipline}/match/${partido.id}`,
      'voley': `/public-voley-match-detail/${partido.id}`,
      'basquet': `/public-basquet-match-detail/${partido.id}`
    };
    
    const route = detailRoutes[discipline] || `/public/${discipline}/match/${partido.id}`;
    navigate(route);
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
    <div className="section-container">
      <div className="section-header" style={{ marginBottom: "2rem" }}>
        <h2 className="section-title">
          <span className="title-icon">⚽</span>
          Partidos
        </h2>
        <p className="section-subtitle">
          Calendario y resultados de los encuentros
        </p>
      </div>

      <div className="filter-controls">
        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label">🚻 Género:</label>
            <select 
              value={filtroGenero} 
              onChange={(e) => handleFiltroGeneroChange(e.target.value)}
              className="modern-select"
            >
              <option value="">Selecciona un género</option>
              {opcionesGenero.map(genero => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">🎓 Nivel Educacional:</label>
            <select 
              value={filtroNivelEducacional} 
              onChange={(e) => handleFiltroNivelEducacionalChange(e.target.value)}
              disabled={!filtroGenero}
              className="modern-select"
            >
              <option value="">Primero selecciona un género</option>
              {getNivelesDisponibles().map(nivel => (
                <option key={nivel} value={nivel}>{nivel}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">🏅 Categoría:</label>
            <select 
              value={filtroCategoria} 
              onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
              disabled={!filtroGenero || !filtroNivelEducacional}
              className="modern-select"
            >
              <option value="">Primero selecciona género y nivel educacional</option>
              {getCategoriasDisponibles().map(categoria => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={limpiarFiltros} 
            className="clear-filters-btn"
            title="Limpiar todos los filtros"
            style={{
              padding: "8px 16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background-color 0.2s"
            }}
          >
            🧹 Limpiar
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
        <div className="no-partidos" style={{
          textAlign: 'center',
          padding: '40px 20px',
          backgroundColor: '#f8f9fa',
          border: '2px dashed #dee2e6',
          borderRadius: '8px',
          margin: '20px 0',
          color: '#6c757d',
          fontWeight: '500'
        }}>
          {filtroGenero && filtroNivelEducacional && filtroCategoria ? 
            "No hay partidos para esta categoría" : 
            "Selecciona los filtros para ver partidos"
          }
        </div>
      ) : (
        <div className="public-matches-section" style={{ marginTop: "2rem" }}>
          <div className="public-empty-state" style={{ display: "none" }}></div>
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
              <div key={nombreGrupo} className="public-match-group">
                <h3 className="public-group-title">
                  {nombreGrupo} ({partidos.length} {partidos.length === 1 ? 'partido' : 'partidos'})
                </h3>
                <div className="public-matches-grid">
                  {partidos.map(match => (
                    <div 
                      key={match.id} 
                      className="public-match-card" 
                      onClick={() => handleMatchClick(match)}
                      style={{ padding: "1.5rem 1.5rem 1.25rem 1.5rem" }}
                    >
                      <div className="public-match-header" style={{ marginBottom: "1rem" }}>
                        <div className="public-match-status" style={{ marginBottom: "0px" }}>
                          <span className={`public-status-badge ${getStatusClass(match.estado)}`}>
                            {getStatusText(match.estado)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="public-match-teams">
                        <div className="public-team">
                          <span className="public-team-name">
                            {match.equipoA?.curso} {match.equipoA?.paralelo}
                          </span>
                        </div>
                        <div className="public-vs">VS</div>
                        <div className="public-team">
                          <span className="public-team-name">
                            {match.equipoB?.curso} {match.equipoB?.paralelo}
                          </span>
                        </div>
                      </div>

                      <div className="public-match-score" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                        <div className="public-score-display">
                          <span>{match.marcadorA ?? 0}</span>
                          <span className="public-score-separator"> - </span>
                          <span>{match.marcadorB ?? 0}</span>
                        </div>
                      </div>

                      <div className="public-match-info" style={{ borderTop: "1px solid #f0f0f0", paddingTop: "0.75rem", marginBottom: "0" }}>
                        <div className="public-match-date">
                          📅 {match.fecha || "Por definir"}
                        </div>
                        <div className="public-match-time">
                          🕒 {match.hora || "Por definir"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
