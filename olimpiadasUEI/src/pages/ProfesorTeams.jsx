import { useEffect, useState } from "react";
import React from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import { query, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import { useNotification } from "../context/NotificationContext";
import "../styles/ProfesorTeams.css";

export default function ProfesorTeams() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  
  // Estados principales
  const [equipos, setEquipos] = useState([]);
  const [nuevoEquipo, setNuevoEquipo] = useState({
    curso: "",
    paralelo: "",
    grupo: "",
    categoria: "",
    nivelEducacional: "",
    genero: ""
  });
  const [grupos, setGrupos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nivelesEducacionales, setNivelesEducacionales] = useState([]);
  const [generosDisponibles, setGenerosDisponibles] = useState([]);
  
  // Estados de filtros
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem('profesor_filtro_categoria') || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem('profesor_filtro_nivel_educacional') || "";
  });
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem('profesor_filtro_genero') || "";
  });

  // Estados de filtros independientes para el selector de equipos
  const [filtroGeneroSelector, setFiltroGeneroSelector] = useState("");
  const [filtroNivelEducacionalSelector, setFiltroNivelEducacionalSelector] = useState("");
  const [filtroCategoriaSelector, setFiltroCategoriaSelector] = useState("");

  // Estados para gestión de jugadores
  const [jugadores, setJugadores] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [jugadorEditando, setJugadorEditando] = useState(null);
  const [numeroAsignar, setNumeroAsignar] = useState("");
  const [nuevoJugador, setNuevoJugador] = useState({
    nombre: "",
    curso: "",
    paralelo: "",
    categoria: "",
    nivelEducacional: "",
    genero: ""
  });
  const [jugadorAEditar, setJugadorAEditar] = useState(null);

  // Estados para modales y progreso
  const [mostrarProgreso, setMostrarProgreso] = useState(false);
  const [progresoMensajes, setProgresoMensajes] = useState([]);
  const [modalConfirmacion, setModalConfirmacion] = useState({ mostrar: false, titulo: '', mensaje: '', callback: null });

  // Estados de carga
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Función para mostrar notificaciones
  const mostrarNotificacion = (mensaje, tipo = 'info') => {
    addNotification(mensaje, tipo);
  };

  const mostrarModalConfirmacion = (titulo, mensaje, callback) => {
    setModalConfirmacion({ mostrar: true, titulo, mensaje, callback });
  };

  const cerrarModalConfirmacion = () => {
    setModalConfirmacion({ mostrar: false, titulo: '', mensaje: '', callback: null });
  };

  const agregarMensajeProgreso = (mensaje) => {
    setProgresoMensajes(prev => {
      const nuevos = [...prev, mensaje];
      return nuevos.slice(-5);
    });
    
    setTimeout(() => {
      setProgresoMensajes(prev => prev.filter(m => m !== mensaje));
    }, 3000);
  };

  // Funciones para manejar filtros persistentes
  const handleFiltroGeneroChange = (genero) => {
    setFiltroGenero(genero);
    // Limpiar nivel educacional y categoría al cambiar género
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    
    if (genero) {
      localStorage.setItem('profesor_filtro_genero', genero);
    } else {
      localStorage.removeItem('profesor_filtro_genero');
    }
    
    // Limpiar localStorage de nivel y categoría
    localStorage.removeItem('profesor_filtro_nivel_educacional');
    localStorage.removeItem('profesor_filtro_categoria');
  };

  const handleFiltroNivelEducacionalChange = (nivelEducacional) => {
    setFiltroNivelEducacional(nivelEducacional);
    if (nivelEducacional) {
      localStorage.setItem('profesor_filtro_nivel_educacional', nivelEducacional);
    } else {
      localStorage.removeItem('profesor_filtro_nivel_educacional');
    }
  };

  const handleFiltroCategoriaChange = (categoria) => {
    setFiltroCategoria(categoria);
    if (categoria) {
      localStorage.setItem('profesor_filtro_categoria', categoria);
    } else {
      localStorage.removeItem('profesor_filtro_categoria');
    }
  };

  // Función para cargar todos los datos
  const cargarTodosDatos = async () => {
    setCargandoDatos(true);
    setErrorCarga(null);
    
    try {
      const [equiposSnap, gruposSnap, categoriasSnap, nivelesSnap] = await Promise.all([
        getDocs(query(collection(db, "equipos"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "grupos"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "categorias"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "nivelesEducacionales"), where("disciplina", "==", discipline)))
      ]);

      const equiposData = equiposSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const gruposData = gruposSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const categoriasData = categoriasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nivelesData = nivelesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Extraer géneros únicos de los equipos
      const generosUnicos = [...new Set(equiposData.map(equipo => equipo.genero))].filter(Boolean).sort();

      setEquipos(equiposData);
      setGrupos(gruposData);
      setCategorias(categoriasData);
      setNivelesEducacionales(nivelesData);
      setGenerosDisponibles(generosUnicos);
      
    } catch (error) {
      console.error("❌ Error al cargar datos:", error);
      setErrorCarga("Error al cargar los datos. Intenta recargar la página.");
      mostrarNotificacion("❌ Error al cargar los datos. Intenta recargar la página.", "error");
    } finally {
      setCargandoDatos(false);
    }
  };

  // Obtener jugadores desde Firestore
  const obtenerJugadores = async () => {
    if (!equipoSeleccionado) return;
    
    const q = query(
      collection(db, "jugadores"),
      where("disciplina", "==", discipline),
      where("genero", "==", equipoSeleccionado.genero),
      where("curso", "==", equipoSeleccionado.curso),
      where("paralelo", "==", equipoSeleccionado.paralelo),
      where("categoria", "==", equipoSeleccionado.categoria)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setJugadores(data);
  };

  // Crear nuevo jugador
  const crearJugador = async () => {
    if (!nuevoJugador.nombre || !equipoSeleccionado) return;
    
    try {
      await addDoc(collection(db, "jugadores"), {
        ...nuevoJugador,
        curso: equipoSeleccionado.curso,
        paralelo: equipoSeleccionado.paralelo,
        categoria: equipoSeleccionado.categoria,
        nivelEducacional: equipoSeleccionado.nivelEducacional,
        genero: equipoSeleccionado.genero,
        disciplina: discipline,
        numero: null,
        fechaCreacion: new Date().toISOString()
      });
      
      setNuevoJugador({ nombre: "", curso: "", paralelo: "", categoria: "", nivelEducacional: "", genero: "" });
      obtenerJugadores();
      mostrarNotificacion("✅ Jugador agregado exitosamente", "success");
    } catch (error) {
      console.error("Error al crear jugador:", error);
      mostrarNotificacion("❌ Error al crear jugador", "error");
    }
  };

  // Actualizar jugador
  const actualizarJugador = async (jugadorId, campo, valor) => {
    try {
      const ref = doc(db, "jugadores", jugadorId);
      await updateDoc(ref, { [campo]: valor });
      obtenerJugadores();
    } catch (error) {
      console.error("Error al actualizar jugador:", error);
      mostrarNotificacion("❌ Error al actualizar jugador", "error");
    }
  };

  // Eliminar jugador
  const eliminarJugador = async (jugadorId, nombreJugador) => {
    mostrarModalConfirmacion(
      "⚠️ Eliminar Jugador",
      `¿Estás seguro de eliminar al jugador "${nombreJugador}"?`,
      async (confirmado) => {
        if (!confirmado) return;
        
        try {
          await deleteDoc(doc(db, "jugadores", jugadorId));
          obtenerJugadores();
          mostrarNotificacion("✅ Jugador eliminado exitosamente", "success");
        } catch (error) {
          console.error("Error al eliminar jugador:", error);
          mostrarNotificacion("❌ Error al eliminar jugador", "error");
        }
      }
    );
  };

  // Asignar número a jugador
  const asignarNumero = async (jugadorId, numero) => {
    if (!numero || numero < 1 || numero > 9999) {
      mostrarNotificacion("⚠️ El número debe estar entre 1 y 9999", "warning");
      return;
    }

    const numeroExiste = jugadores.some(j =>
      j.id !== jugadorId &&
      j.numero === parseInt(numero)
    );

    if (numeroExiste) {
      mostrarNotificacion(`⚠️ El número ${numero} ya está asignado a otro jugador de este equipo`, "warning");
      return;
    }

    try {
      const ref = doc(db, "jugadores", jugadorId);
      await updateDoc(ref, { numero: parseInt(numero) });
      obtenerJugadores();
      setJugadorEditando(null);
      setNumeroAsignar("");
      mostrarNotificacion(`✅ Número ${numero} asignado exitosamente`, "success");
    } catch (error) {
      console.error("Error al asignar número:", error);
      mostrarNotificacion("❌ Error al asignar número", "error");
    }
  };

  // Exportar jugadores a Excel
  const exportarJugadores = () => {
    if (jugadores.length === 0) {
      mostrarNotificacion("⚠️ No hay jugadores para exportar", "warning");
      return;
    }

    const datosExport = jugadores.map(jugador => ({
      "Número": jugador.numero || "Sin asignar",
      "Nombre": jugador.nombre,
      "Curso": jugador.curso,
      "Paralelo": jugador.paralelo,
      "Categoría": jugador.categoria,
      "Nivel Educacional": jugador.nivelEducacional,
      "Género": jugador.genero
    }));

    const ws = XLSX.utils.json_to_sheet(datosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jugadores");
    
    const nombreArchivo = `Jugadores_${equipoSeleccionado?.curso}_${equipoSeleccionado?.paralelo}_${discipline}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    mostrarNotificacion("✅ Lista de jugadores exportada exitosamente", "success");
  };

  // Filtrar equipos
  const equiposFiltrados = equipos.filter(equipo => {
    const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
    const pasaNivelEducacional = filtroNivelEducacional === "" || equipo.nivelEducacional === filtroNivelEducacional;
    const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
    return pasaCategoria && pasaNivelEducacional && pasaGenero;
  });

  // Filtrar equipos para el selector
  const equiposParaSelector = equipos.filter(equipo => {
    const pasaGenero = filtroGeneroSelector === "" || equipo.genero === filtroGeneroSelector;
    const pasaNivelEducacional = filtroNivelEducacionalSelector === "" || equipo.nivelEducacional === filtroNivelEducacionalSelector;
    const pasaCategoria = filtroCategoriaSelector === "" || equipo.categoria === filtroCategoriaSelector;
    return pasaGenero && pasaNivelEducacional && pasaCategoria;
  });

  useEffect(() => {
    cargarTodosDatos();
  }, [discipline]);

  useEffect(() => {
    if (equipoSeleccionado) {
      obtenerJugadores();
    }
  }, [equipoSeleccionado]);

  // Volver al dashboard del profesor
  const volverAlDashboard = () => {
    navigate("/profesor");
  };

  if (cargandoDatos) {
    return (
      <div className="profesor-teams-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando equipos...</p>
        </div>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="profesor-teams-container">
        <div className="error-container">
          <h2>❌ Error</h2>
          <p>{errorCarga}</p>
          <button onClick={cargarTodosDatos} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profesor-teams-container">
      {/* Header */}
      <div className="profesor-teams-header">
        <div className="header-left">
          <button onClick={volverAlDashboard} className="back-button">
            ← Volver
          </button>
          <div className="header-info">
            <h1>Gestión de Equipos y Jugadores</h1>
            <p className="discipline-name">{discipline?.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-section">
        <h3>🔍 Filtros</h3>
        <div className="filtros-grid">
          <div className="filtro-grupo">
            <label>Género:</label>
            <select 
              value={filtroGenero} 
              onChange={(e) => handleFiltroGeneroChange(e.target.value)}
            >
              <option value="">Todos</option>
              {generosDisponibles.map(genero => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>
          </div>

          <div className="filtro-grupo">
            <label>Nivel Educacional:</label>
            <select 
              value={filtroNivelEducacional} 
              onChange={(e) => handleFiltroNivelEducacionalChange(e.target.value)}
              disabled={!filtroGenero}
              style={{
                backgroundColor: !filtroGenero ? '#f5f5f5' : '',
                color: !filtroGenero ? '#999' : '',
                cursor: !filtroGenero ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">{!filtroGenero ? "Selecciona género primero" : "Todos"}</option>
              {[...new Set(nivelesEducacionales
                .filter(nivel => {
                  if (filtroGenero === "") return true;
                  return categorias.some(cat => cat.nivelEducacional === nivel.nombre && cat.genero === filtroGenero);
                })
                .map(nivel => nivel.nombre))].sort().map(nivel => (
                <option key={nivel} value={nivel}>{nivel}</option>
              ))}
            </select>
          </div>

          <div className="filtro-grupo">
            <label>Categoría:</label>
            <select 
              value={filtroCategoria} 
              onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias
                .filter(cat => 
                  (filtroNivelEducacional === "" || cat.nivelEducacional === filtroNivelEducacional) &&
                  (filtroGenero === "" || cat.genero === filtroGenero)
                )
                .reduce((unique, cat) => {
                  // Eliminar duplicados por nombre de categoría
                  if (!unique.find(item => item.nombre === cat.nombre)) {
                    unique.push(cat);
                  }
                  return unique;
                }, [])
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(categoria => (
                  <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Equipos */}
      <div className="equipos-section">
        <h3>👥 Equipos ({equiposFiltrados.length})</h3>
        
        {equiposFiltrados.length === 0 ? (
          <div className="no-equipos">
            <p>No hay equipos que coincidan con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="equipos-grid">
            {equiposFiltrados.map(equipo => (
              <div 
                key={equipo.id} 
                className={`equipo-card ${equipoSeleccionado?.id === equipo.id ? 'selected' : ''}`}
                onClick={() => setEquipoSeleccionado(equipo)}
              >
                <div className="equipo-info">
                  <h4>{equipo.curso} {equipo.paralelo}</h4>
                  <p className="equipo-details">
                    {equipo.genero} - {equipo.categoria}
                  </p>
                  <p className="equipo-nivel">{equipo.nivelEducacional}</p>
                  {equipo.grupo && (
                    <p className="equipo-grupo">Grupo: {equipo.grupo}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestión de Jugadores */}
      {equipoSeleccionado && (
        <div className="jugadores-section">
          <div className="jugadores-header">
            <h3>
              ⚽ Jugadores de {equipoSeleccionado.curso} {equipoSeleccionado.paralelo}
              <span className="jugadores-count">({jugadores.length})</span>
            </h3>
            <div className="jugadores-actions">
              <button onClick={exportarJugadores} className="export-button">
                📄 Exportar Excel
              </button>
            </div>
          </div>

          {/* Agregar nuevo jugador */}
          <div className="nuevo-jugador-form">
            <h4>➕ Agregar Jugador</h4>
            <div className="form-row">
              <input
                type="text"
                placeholder="Nombre del jugador"
                value={nuevoJugador.nombre}
                onChange={(e) => setNuevoJugador({...nuevoJugador, nombre: e.target.value})}
              />
              <button onClick={crearJugador} className="add-button">
                Agregar
              </button>
            </div>
          </div>

          {/* Lista de jugadores */}
          <div className="jugadores-lista">
            {jugadores.length === 0 ? (
              <div className="no-jugadores">
                <p>No hay jugadores registrados en este equipo</p>
              </div>
            ) : (
              <div className="jugadores-table">
                <div className="table-header">
                  <div className="col-numero">N°</div>
                  <div className="col-nombre">Nombre</div>
                  <div className="col-acciones">Acciones</div>
                </div>
                
                {jugadores
                  .sort((a, b) => (a.numero || 999) - (b.numero || 999))
                  .map(jugador => (
                    <div key={jugador.id} className="jugador-row">
                      <div className="col-numero">
                        {jugadorEditando === jugador.id ? (
                          <div className="numero-edit">
                            <input
                              type="number"
                              min="1"
                              max="9999"
                              value={numeroAsignar}
                              onChange={(e) => setNumeroAsignar(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  asignarNumero(jugador.id, numeroAsignar);
                                }
                              }}
                              autoFocus
                            />
                            <button 
                              onClick={() => asignarNumero(jugador.id, numeroAsignar)}
                              className="save-numero"
                              title="Guardar número"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => {
                                setJugadorEditando(null);
                                setNumeroAsignar("");
                              }}
                              className="cancel-numero"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span 
                            className="numero-display"
                            onClick={() => {
                              setJugadorEditando(jugador.id);
                              setNumeroAsignar(jugador.numero?.toString() || "");
                            }}
                            title="Click para asignar número"
                          >
                            {jugador.numero || "Sin N°"}
                          </span>
                        )}
                      </div>
                      
                      <div className="col-nombre">
                        {jugadorAEditar === jugador.id ? (
                          <input
                            type="text"
                            value={jugador.nombre}
                            onChange={(e) => actualizarJugador(jugador.id, 'nombre', e.target.value)}
                            onBlur={() => setJugadorAEditar(null)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                setJugadorAEditar(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span 
                            onClick={() => setJugadorAEditar(jugador.id)}
                            className="nombre-editable"
                            title="Click para editar nombre"
                          >
                            {jugador.nombre}
                          </span>
                        )}
                      </div>
                      
                      <div className="col-acciones">
                        <button 
                          onClick={() => eliminarJugador(jugador.id, jugador.nombre)}
                          className="delete-button"
                          title="Eliminar jugador"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmación - mantener solo para eliminar jugadores */}
      {modalConfirmacion.mostrar && (
        <div className="modal-overlay confirmation">
          <div className="modal-content">
            <h3>{modalConfirmacion.titulo}</h3>
            <p>{modalConfirmacion.mensaje}</p>
            <div className="modal-buttons">
              <button
                onClick={() => {
                  modalConfirmacion.callback(true);
                  cerrarModalConfirmacion();
                }}
                className="confirm-button"
              >
                Confirmar
              </button>
              <button
                onClick={() => {
                  modalConfirmacion.callback(false);
                  cerrarModalConfirmacion();
                }}
                className="cancel-button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de progreso */}
      {mostrarProgreso && (
        <div className="modal-overlay progress">
          <div className="modal-content progress-modal">
            <h3>🔄 Procesando...</h3>
            <div className="progress-messages">
              {progresoMensajes.map((mensaje, index) => (
                <p key={index} className="progress-message">{mensaje}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
