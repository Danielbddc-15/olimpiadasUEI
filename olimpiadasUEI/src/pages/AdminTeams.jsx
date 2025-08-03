import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams, useNavigate } from "react-router-dom";
import { query, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import "../styles/AdminTeams.css";

export default function AdminTeams() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [equipos, setEquipos] = useState([]);
  const [nuevoEquipo, setNuevoEquipo] = useState({
    curso: "",
    paralelo: "",
    grupo: "",
    categoria: "",
    genero: ""
  });
  const [grupos, setGrupos] = useState([]);
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [nuevoNombreCategoria, setNuevoNombreCategoria] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [jugadorEditando, setJugadorEditando] = useState(null);
  const [numeroAsignar, setNumeroAsignar] = useState("");
  const [nuevoJugador, setNuevoJugador] = useState({
    nombre: "",
    curso: "",
    paralelo: "",
    categoria: "",
    genero: ""
  });
  const [jugadorAEditar, setJugadorAEditar] = useState(null);
  // Obtener categorías desde Firestore
  const obtenerCategorias = async () => {
    const q = query(
      collection(db, "categorias"),
      where("disciplina", "==", discipline)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setCategorias(data);
  };

  // Obtener grupos desde Firestore
  const obtenerGrupos = async () => {
    const q = query(
      collection(db, "grupos"),
      where("disciplina", "==", discipline)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setGrupos(data);
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

  const obtenerEquipos = async () => {
    const q = query(
      collection(db, "equipos"),
      where("disciplina", "==", discipline),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(data);
  };

  useEffect(() => {
    obtenerEquipos();
    obtenerGrupos();
    obtenerCategorias();
  }, []);

  useEffect(() => {
    if (equipoSeleccionado) {
      obtenerJugadores();
    }
  }, [equipoSeleccionado]);

  const crearEquipo = async () => {
    if (!nuevoEquipo.curso || !nuevoEquipo.paralelo || !nuevoEquipo.categoria || !nuevoEquipo.genero) return;
    
    // Si el grupo no existe, agrégalo relacionado con la categoría y género
    if (nuevoEquipo.grupo && !grupos.find(g => 
      g.nombre === nuevoEquipo.grupo && 
      g.categoria === nuevoEquipo.categoria && 
      g.genero === nuevoEquipo.genero
    )) {
      await addDoc(collection(db, "grupos"), {
        nombre: nuevoEquipo.grupo.trim(),
        categoria: nuevoEquipo.categoria,
        genero: nuevoEquipo.genero,
        disciplina: discipline,
      });
      await obtenerGrupos();
    }
    
    await addDoc(collection(db, "equipos"), {
      ...nuevoEquipo,
      grupo: nuevoEquipo.grupo || "Sin grupo",
      disciplina: discipline,
    });
    setNuevoEquipo({ curso: "", paralelo: "", grupo: "", categoria: "", genero: "" });
    obtenerEquipos();
  };

  const eliminarGrupo = async (nombreGrupo, categoria, genero) => {
    const q = query(
      collection(db, "grupos"),
      where("disciplina", "==", discipline),
      where("nombre", "==", nombreGrupo),
      where("categoria", "==", categoria),
      where("genero", "==", genero)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const grupoDoc = snapshot.docs[0];
      await deleteDoc(doc(db, "grupos", grupoDoc.id));
      obtenerGrupos();
      obtenerEquipos();
    }
  };

  const actualizarEquipo = async (id, campo, valor) => {
    const ref = doc(db, "equipos", id);
    
    // Si se cambia la categoría o género, también limpiar el grupo
    if (campo === "categoria" || campo === "genero") {
      await updateDoc(ref, { 
        [campo]: valor,
        grupo: "" // Limpiar grupo al cambiar categoría o género
      });
    } else {
      await updateDoc(ref, { [campo]: valor });
    }
    
    obtenerEquipos();
  };

  const eliminarEquipo = async (id) => {
    await deleteDoc(doc(db, "equipos", id));
    obtenerEquipos();
  };

  // Función para eliminar categoría
  const eliminarCategoria = async (categoriaId, categoriaNombre, generoCategoria) => {
    // Verificar si hay equipos usando esta categoría y género
    const equiposConCategoria = equipos.filter(equipo => 
      equipo.categoria === categoriaNombre && equipo.genero === generoCategoria
    );
    if (equiposConCategoria.length > 0) {
      alert(`No se puede eliminar la categoría "${categoriaNombre}" (${generoCategoria}) porque hay ${equiposConCategoria.length} equipo(s) asignado(s) a esta categoría.`);
      return;
    }

    // Eliminar grupos relacionados con esta categoría y género
    const gruposRelacionados = grupos.filter(grupo => 
      grupo.categoria === categoriaNombre && grupo.genero === generoCategoria
    );
    for (const grupo of gruposRelacionados) {
      await deleteDoc(doc(db, "grupos", grupo.id));
    }

    // Eliminar la categoría
    await deleteDoc(doc(db, "categorias", categoriaId));
    
    // Actualizar datos
    obtenerCategorias();
    obtenerGrupos();
    
    // Limpiar filtro si se eliminó la categoría filtrada
    if (filtroCategoria === categoriaNombre) {
      setFiltroCategoria("");
    }
  };

  // Función para actualizar categoría
  const actualizarCategoria = async (categoriaId, nuevoNombre, nombreAnterior, generoCategoria) => {
    // Actualizar la categoría
    const ref = doc(db, "categorias", categoriaId);
    await updateDoc(ref, { nombre: nuevoNombre });

    // Actualizar todos los equipos que tenían la categoría anterior
    const equiposConCategoria = equipos.filter(equipo => 
      equipo.categoria === nombreAnterior && equipo.genero === generoCategoria
    );
    for (const equipo of equiposConCategoria) {
      const equipoRef = doc(db, "equipos", equipo.id);
      await updateDoc(equipoRef, { categoria: nuevoNombre });
    }

    // Actualizar todos los grupos que tenían la categoría anterior
    const gruposConCategoria = grupos.filter(grupo => 
      grupo.categoria === nombreAnterior && grupo.genero === generoCategoria
    );
    for (const grupo of gruposConCategoria) {
      const grupoRef = doc(db, "grupos", grupo.id);
      await updateDoc(grupoRef, { categoria: nuevoNombre });
    }

    // Actualizar filtro si estaba usando la categoría anterior
    if (filtroCategoria === nombreAnterior) {
      setFiltroCategoria(nuevoNombre);
    }

    // Refrescar datos
    obtenerCategorias();
    obtenerGrupos();
    obtenerEquipos();
    
    // Limpiar estado de edición
    setCategoriaEditando(null);
    setNuevoNombreCategoria("");
  };

  // Función para asignar número a jugador
  const asignarNumero = async (jugadorId, numero) => {
    if (!numero || numero < 1 || numero > 99) {
      alert("El número debe estar entre 1 y 99");
      return;
    }

    // Verificar que el número no esté usado por otro jugador del mismo equipo
    const numeroExiste = jugadores.some(j => 
      j.id !== jugadorId && 
      j.numero === parseInt(numero) &&
      j.curso === equipoSeleccionado.curso &&
      j.paralelo === equipoSeleccionado.paralelo &&
      j.categoria === equipoSeleccionado.categoria &&
      j.genero === equipoSeleccionado.genero
    );

    if (numeroExiste) {
      alert(`El número ${numero} ya está asignado a otro jugador de este equipo`);
      return;
    }

    try {
      const ref = doc(db, "jugadores", jugadorId);
      await updateDoc(ref, { numero: parseInt(numero) });
      obtenerJugadores();
      setJugadorEditando(null);
      setNumeroAsignar("");
    } catch (error) {
      console.error("Error al asignar número:", error);
      alert("Error al asignar número");
    }
  };

  // Función para importar jugadores desde Excel
  const importarJugadores = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let importados = 0;
      let errores = [];

      for (const fila of jsonData) {
        const { nombre, curso, paralelo, categoria, genero } = fila;

        if (!nombre || !curso || !paralelo || !categoria || !genero) {
          errores.push(`Fila con datos incompletos: ${JSON.stringify(fila)}`);
          continue;
        }

        // Validar género
        if (genero.toLowerCase() !== 'hombre' && genero.toLowerCase() !== 'mujer') {
          errores.push(`Género inválido para ${nombre}. Debe ser "Hombre" o "Mujer"`);
          continue;
        }

        // Verificar que la categoría existe para este género
        const categoriaExiste = categorias.find(cat => 
          cat.nombre === categoria && cat.genero === genero
        );
        if (!categoriaExiste) {
          errores.push(`Categoría "${categoria}" para género "${genero}" no existe para ${nombre}`);
          continue;
        }

        // Verificar que no existe el jugador
        const jugadorExiste = jugadores.some(j => 
          j.nombre.toLowerCase() === nombre.toLowerCase() &&
          j.curso === curso &&
          j.paralelo === paralelo &&
          j.categoria === categoria &&
          j.genero === genero
        );

        if (jugadorExiste) {
          errores.push(`Jugador "${nombre}" ya existe en ${curso} ${paralelo} (${genero})`);
          continue;
        }

        // Crear jugador
        await addDoc(collection(db, "jugadores"), {
          nombre: nombre.trim(),
          curso: curso.trim(),
          paralelo: paralelo.trim(),
          categoria: categoria.trim(),
          genero: genero.trim(),
          disciplina: discipline,
          numero: null,
          fechaCreacion: new Date().toISOString()
        });

        importados++;
      }

      alert(`Importación completada:\n- ${importados} jugadores importados\n- ${errores.length} errores`);
      
      if (errores.length > 0) {
        console.log("Errores en importación:", errores);
      }

      obtenerJugadores();
      event.target.value = '';
    } catch (error) {
      console.error("Error al importar:", error);
      alert("Error al procesar el archivo Excel");
    }
  };

  // Función para crear jugador manual
  const crearJugador = async () => {
    if (!equipoSeleccionado) {
      alert("Primero selecciona un equipo");
      return;
    }

    if (!nuevoJugador.nombre.trim()) {
      alert("El nombre del jugador es obligatorio");
      return;
    }

    // Verificar que no existe el jugador en este equipo
    const jugadorExiste = jugadores.some(j => 
      j.nombre.toLowerCase() === nuevoJugador.nombre.toLowerCase()
    );

    if (jugadorExiste) {
      alert(`El jugador "${nuevoJugador.nombre}" ya existe en este equipo`);
      return;
    }

    try {
      await addDoc(collection(db, "jugadores"), {
        nombre: nuevoJugador.nombre.trim(),
        curso: equipoSeleccionado.curso,
        paralelo: equipoSeleccionado.paralelo,
        categoria: equipoSeleccionado.categoria,
        genero: equipoSeleccionado.genero,
        disciplina: discipline,
        numero: null,
        fechaCreacion: new Date().toISOString()
      });

      setNuevoJugador({
        nombre: "",
        curso: "",
        paralelo: "",
        categoria: "",
        genero: ""
      });

      obtenerJugadores();
      alert("Jugador creado exitosamente");
    } catch (error) {
      console.error("Error al crear jugador:", error);
      alert("Error al crear jugador");
    }
  };

  // Función para actualizar jugador
  const actualizarJugador = async (jugadorId, datos) => {
    try {
      const ref = doc(db, "jugadores", jugadorId);
      await updateDoc(ref, {
        ...datos,
        fechaActualizacion: new Date().toISOString()
      });
      
      obtenerJugadores();
      setJugadorAEditar(null);
      alert("Jugador actualizado exitosamente");
    } catch (error) {
      console.error("Error al actualizar jugador:", error);
      alert("Error al actualizar jugador");
    }
  };

  // Función para eliminar jugador
  const eliminarJugador = async (jugadorId, nombreJugador) => {
    if (window.confirm(`¿Estás seguro de eliminar al jugador "${nombreJugador}"?`)) {
      try {
        await deleteDoc(doc(db, "jugadores", jugadorId));
        obtenerJugadores();
        alert("Jugador eliminado exitosamente");
      } catch (error) {
        console.error("Error al eliminar jugador:", error);
        alert("Error al eliminar jugador");
      }
    }
  };

  // Navigation handlers
  const goToMatches = () => {
    navigate(`/admin/${discipline}/partidos`);
  };

  const goToStandings = () => {
    navigate(`/admin/${discipline}/tabla`);
  };

  const goToSchedule = () => {
    navigate(`/admin/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/admin');
  };

  return (
    <div className="admin-teams-container">
      {/* Header moderno */}
      <div className="admin-header">
        <div className="header-icon">👥</div>
        <h1 className="admin-title">Gestión de Equipos</h1>
        <p className="admin-subtitle">
          Administra los equipos de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Navegación rápida */}
      <div className="quick-navigation">
        <button onClick={goToPanel} className="nav-card panel-card">
          <div className="nav-card-icon">🏠</div>
          <div className="nav-card-content">
            <h3>Volver al Panel</h3>
            <p>Ir al panel principal</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToMatches} className="nav-card matches-card">
          <div className="nav-card-icon">⚽</div>
          <div className="nav-card-content">
            <h3>Partidos</h3>
            <p>Gestionar encuentros</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToStandings} className="nav-card standings-card">
          <div className="nav-card-icon">🏆</div>
          <div className="nav-card-content">
            <h3>Posiciones</h3>
            <p>Ver clasificación</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToSchedule} className="nav-card schedule-card">
          <div className="nav-card-icon">📅</div>
          <div className="nav-card-content">
            <h3>Gestionar Horarios</h3>
            <p>Organizar encuentros</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
      </div>

      {/* Formulario unificado de creación de categorías y equipos */}
      <div className="create-team-section" style={{background:'white', borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.1)', padding:'2rem 1.5rem', marginBottom:32}}>
        {/* Apartado para crear categoría */}
        <div style={{marginBottom:32, textAlign:'center'}}>
          <h2 className="section-title" style={{textAlign:'center'}}>
            <span className="section-icon">🏷️</span>
            Crear Nueva Categoría
          </h2>
          <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
            <input
              type="text"
              placeholder="Ej: Sub 14, Superior, etc."
              value={nuevaCategoria}
              onChange={e => setNuevaCategoria(e.target.value)}
              className="modern-input"
              style={{minWidth:220, maxWidth:340}}
            />
            <select
              value={filtroGenero}
              onChange={e => setFiltroGenero(e.target.value)}
              className="modern-input"
              style={{minWidth:140, maxWidth:160}}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
            <button
              onClick={async () => {
                if (!nuevaCategoria.trim() || !filtroGenero) {
                  alert("Debes ingresar el nombre de la categoría y seleccionar un género");
                  return;
                }
                await addDoc(collection(db, "categorias"), { 
                  nombre: nuevaCategoria.trim(),
                  genero: filtroGenero,
                  disciplina: discipline 
                });
                setNuevaCategoria("");
                obtenerCategorias();
              }}
              className="create-btn"
              style={{
                padding:'0 1.2em', 
                minWidth:120,
                opacity: (!nuevaCategoria.trim() || !filtroGenero) ? 0.5 : 1,
                cursor: (!nuevaCategoria.trim() || !filtroGenero) ? 'not-allowed' : 'pointer'
              }}
              disabled={!nuevaCategoria.trim() || !filtroGenero}
            >
              <span className="btn-icon">✨</span>
              <span>Crear Categoría</span>
            </button>
            {categorias.length > 0 && (
              <div style={{marginTop:16, display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', width:'100%'}}>
                {categorias
                  .filter(cat => filtroGenero === "" || cat.genero === filtroGenero)
                  .map(cat => (
                  <div key={cat.id} style={{background:'#e7e3fa', borderRadius:8, padding:'4px 8px', fontSize:'0.98em', display:'inline-flex', alignItems:'center', gap:6}}>
                    {categoriaEditando === cat.id ? (
                      // Modo edición
                      <div style={{display:'flex', alignItems:'center', gap:4}}>
                        <input
                          type="text"
                          value={nuevoNombreCategoria}
                          onChange={e => setNuevoNombreCategoria(e.target.value)}
                          style={{
                            fontSize:'0.9em',
                            padding:'2px 6px',
                            border:'1px solid #ccc',
                            borderRadius:4,
                            minWidth:'100px'
                          }}
                          onKeyPress={e => {
                            if (e.key === 'Enter') {
                              actualizarCategoria(cat.id, nuevoNombreCategoria.trim(), cat.nombre, cat.genero);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => actualizarCategoria(cat.id, nuevoNombreCategoria.trim(), cat.nombre, cat.genero)}
                          style={{
                            background:'#4CAF50',
                            color:'white',
                            border:'none',
                            borderRadius:4,
                            padding:'2px 6px',
                            fontSize:'0.8em',
                            cursor:'pointer'
                          }}
                          title="Guardar cambios"
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => {
                            setCategoriaEditando(null);
                            setNuevoNombreCategoria("");
                          }}
                          style={{
                            background:'#f44336',
                            color:'white',
                            border:'none',
                            borderRadius:4,
                            padding:'2px 6px',
                            fontSize:'0.8em',
                            cursor:'pointer'
                          }}
                          title="Cancelar"
                        >
                          ❌
                        </button>
                      </div>
                    ) : (
                      // Modo normal
                      <>
                        <span>{cat.nombre} ({cat.genero})</span>
                        <button
                          onClick={() => {
                            setCategoriaEditando(cat.id);
                            setNuevoNombreCategoria(cat.nombre);
                          }}
                          style={{
                            background:'#2196F3',
                            color:'white',
                            border:'none',
                            borderRadius:4,
                            padding:'2px 6px',
                            fontSize:'0.8em',
                            cursor:'pointer',
                            marginLeft:4
                          }}
                          title="Editar categoría"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar la categoría "${cat.nombre}" (${cat.genero})?\n\nEsto también eliminará todos los grupos relacionados.`)) {
                              eliminarCategoria(cat.id, cat.nombre, cat.genero);
                            }
                          }}
                          style={{
                            background:'#f44336',
                            color:'white',
                            border:'none',
                            borderRadius:4,
                            padding:'2px 6px',
                            fontSize:'0.8em',
                            cursor:'pointer'
                          }}
                          title="Eliminar categoría"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Apartado para crear equipo */}
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Crear Nuevo Equipo
        </h2>

        <div className="create-team-form">
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🚻</span>
                Género
              </label>
              <select
                className="modern-input"
                value={nuevoEquipo.genero}
                onChange={e => {
                  setNuevoEquipo({ 
                    ...nuevoEquipo, 
                    genero: e.target.value,
                    categoria: "", // Limpiar categoría al cambiar género
                    grupo: "" // Limpiar grupo al cambiar género
                  });
                }}
              >
                <option value="">Selecciona un género</option>
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏷️</span>
                Categoría
              </label>
              <select
                className="modern-input"
                value={nuevoEquipo.categoria}
                onChange={e => {
                  setNuevoEquipo({ 
                    ...nuevoEquipo, 
                    categoria: e.target.value,
                    grupo: "" // Limpiar grupo al cambiar categoría
                  });
                }}
                disabled={!nuevoEquipo.genero}
                style={{
                  backgroundColor: !nuevoEquipo.genero ? '#f5f5f5' : '',
                  color: !nuevoEquipo.genero ? '#999' : '',
                  cursor: !nuevoEquipo.genero ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="">Selecciona una categoría</option>
                {categorias
                  .filter(cat => cat.genero === nuevoEquipo.genero)
                  .map(cat => (
                    <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                  ))}
              </select>
              {!nuevoEquipo.genero && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona un género
                </small>
              )}
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🎓</span>
                Curso
              </label>
              <input
                type="text"
                placeholder="Ej: 1ro BGU"
                value={nuevoEquipo.curso}
                onChange={(e) =>
                  setNuevoEquipo({ ...nuevoEquipo, curso: e.target.value })
                }
                className="modern-input"
                disabled={!nuevoEquipo.genero}
                style={{
                  backgroundColor: !nuevoEquipo.genero ? '#f5f5f5' : '',
                  color: !nuevoEquipo.genero ? '#999' : '',
                  cursor: !nuevoEquipo.genero ? 'not-allowed' : 'text'
                }}
              />
              {!nuevoEquipo.genero && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona un género
                </small>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📝</span>
                Paralelo
              </label>
              <input
                type="text"
                placeholder="Ej: A, B, C"
                value={nuevoEquipo.paralelo}
                onChange={(e) =>
                  setNuevoEquipo({ ...nuevoEquipo, paralelo: e.target.value })
                }
                className="modern-input"
                disabled={!nuevoEquipo.genero}
                style={{
                  backgroundColor: !nuevoEquipo.genero ? '#f5f5f5' : '',
                  color: !nuevoEquipo.genero ? '#999' : '',
                  cursor: !nuevoEquipo.genero ? 'not-allowed' : 'text'
                }}
              />
              {!nuevoEquipo.genero && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona un género
                </small>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏆</span>
                Grupo
              </label>
              <div className="group-input-wrapper">
                <input
                  list="grupos-list"
                  type="text"
                  placeholder="Selecciona o crea grupo"
                  value={nuevoEquipo.grupo || ""}
                  onChange={(e) =>
                    setNuevoEquipo({ ...nuevoEquipo, grupo: e.target.value })
                  }
                  className="modern-input"
                  disabled={!nuevoEquipo.categoria || !nuevoEquipo.genero}
                  style={{
                    backgroundColor: (!nuevoEquipo.categoria || !nuevoEquipo.genero) ? '#f5f5f5' : '',
                    color: (!nuevoEquipo.categoria || !nuevoEquipo.genero) ? '#999' : '',
                    cursor: (!nuevoEquipo.categoria || !nuevoEquipo.genero) ? 'not-allowed' : 'text'
                  }}
                />
                <datalist id="grupos-list">
                  {grupos
                    .filter(g => 
                      g.categoria === nuevoEquipo.categoria && 
                      g.genero === nuevoEquipo.genero
                    )
                    .map((g) => (
                      <option key={g.id} value={g.nombre} />
                    ))}
                </datalist>
                {nuevoEquipo.grupo && (
                  <button
                    className="delete-group-btn"
                    title={`Eliminar grupo "${nuevoEquipo.grupo}"`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el grupo "${nuevoEquipo.grupo}"?`,
                        )
                      ) {
                        eliminarGrupo(nuevoEquipo.grupo, nuevoEquipo.categoria, nuevoEquipo.genero);
                        setNuevoEquipo({ ...nuevoEquipo, grupo: "" });
                      }
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
              {(!nuevoEquipo.categoria || !nuevoEquipo.genero) && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona género y categoría
                </small>
              )}
            </div>

            <button 
              onClick={crearEquipo} 
              className="create-btn"
              disabled={!nuevoEquipo.genero || !nuevoEquipo.curso || !nuevoEquipo.paralelo || !nuevoEquipo.categoria}
              style={{
                opacity: (!nuevoEquipo.genero || !nuevoEquipo.curso || !nuevoEquipo.paralelo || !nuevoEquipo.categoria) ? 0.5 : 1,
                cursor: (!nuevoEquipo.genero || !nuevoEquipo.curso || !nuevoEquipo.paralelo || !nuevoEquipo.categoria) ? 'not-allowed' : 'pointer'
              }}
            >
              <span className="btn-icon">✨</span>
              <span>Crear Equipo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de equipos */}
      <div className="teams-table-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📋</span>
            Equipos Registrados
          </h2>
          <div className="teams-count">
            <span className="count-badge">
              {equipos.filter(equipo => {
                const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
                const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
                return pasaGenero && pasaCategoria;
              }).length}
            </span>
            <span>
              {(() => {
                if (filtroGenero === "" && filtroCategoria === "") return "equipos totales";
                if (filtroGenero !== "" && filtroCategoria === "") return `equipos ${filtroGenero}`;
                if (filtroGenero === "" && filtroCategoria !== "") return `equipos en ${filtroCategoria}`;
                return `equipos ${filtroGenero} en ${filtroCategoria}`;
              })()}
            </span>
          </div>
        </div>

        {/* Filtros por género y categoría */}
        <div style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🚻</span>
              Filtrar por género:
            </label>
            <select
              value={filtroGenero}
              onChange={e => {
                setFiltroGenero(e.target.value);
                // Limpiar filtro de categoría si cambia el género
                setFiltroCategoria("");
              }}
              className="modern-input"
              style={{minWidth: '140px', maxWidth: '160px'}}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🏷️</span>
              Filtrar por categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="modern-input"
              style={{
                minWidth: '200px', 
                maxWidth: '300px',
                backgroundColor: !filtroGenero ? '#f5f5f5' : '',
                color: !filtroGenero ? '#999' : '',
                cursor: !filtroGenero ? 'not-allowed' : 'pointer'
              }}
              disabled={!filtroGenero}
            >
              <option value="">Todas las categorías</option>
              {categorias
                .filter(cat => !filtroGenero || cat.genero === filtroGenero)
                .map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <div className="modern-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">�️</span>
                      Categoría
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">�🎓</span>
                      Curso
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">📝</span>
                      Paralelo
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">🏆</span>
                      Grupo
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">⚙️</span>
                      Acciones
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...equipos]
                  .filter(equipo => {
                    const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
                    const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .sort((a, b) => {
                    // Primero ordenar por género
                    if ((a.genero || "") < (b.genero || "")) return -1;
                    if ((a.genero || "") > (b.genero || "")) return 1;
                    // Luego por categoría
                    if ((a.categoria || "") < (b.categoria || "")) return -1;
                    if ((a.categoria || "") > (b.categoria || "")) return 1;
                    // Luego por grupo
                    if ((a.grupo || "") < (b.grupo || "")) return -1;
                    if ((a.grupo || "") > (b.grupo || "")) return 1;
                    // Luego por curso
                    if ((a.curso || "") < (b.curso || "")) return -1;
                    if ((a.curso || "") > (b.curso || "")) return 1;
                    // Finalmente por paralelo
                    if ((a.paralelo || "") < (b.paralelo || "")) return -1;
                    if ((a.paralelo || "") > (b.paralelo || "")) return 1;
                    return 0;
                  })
                  .map((equipo) => (
                    <tr key={equipo.id} className="table-row">
                      <td className="table-cell">
                        <select
                          value={equipo.genero || ""}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "genero", e.target.value)
                          }
                          className="table-select"
                        >
                          <option value="">Sin género</option>
                          <option value="Hombre">Hombre</option>
                          <option value="Mujer">Mujer</option>
                        </select>
                      </td>
                      <td className="table-cell">
                        <select
                          value={equipo.categoria || ""}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "categoria", e.target.value)
                          }
                          className="table-select"
                        >
                          <option value="">Sin categoría</option>
                          {categorias
                            .filter(cat => !equipo.genero || cat.genero === equipo.genero)
                            .map((cat) => (
                              <option key={cat.id} value={cat.nombre}>
                                {cat.nombre}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="table-cell">
                        <input
                          value={equipo.curso}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "curso", e.target.value)
                          }
                          className="table-input"
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          value={equipo.paralelo}
                          onChange={(e) =>
                            actualizarEquipo(
                              equipo.id,
                              "paralelo",
                              e.target.value,
                            )
                          }
                          className="table-input"
                        />
                      </td>
                      <td className="table-cell">
                        <select
                          value={equipo.grupo || ""}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "grupo", e.target.value)
                          }
                          className="table-select"
                        >
                          <option value="">Sin grupo</option>
                          {grupos
                            .filter(g => g.categoria === equipo.categoria)
                            .map((g) => (
                              <option key={g.id} value={g.nombre}>
                                {g.nombre}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => eliminarEquipo(equipo.id)}
                          className="delete-team-btn"
                          title="Eliminar equipo"
                        >
                          <span className="btn-icon">🗑️</span>
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {equipos.filter(equipo => {
            const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
            const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
            return pasaGenero && pasaCategoria;
          }).length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>
                {(() => {
                  if (filtroGenero === "" && filtroCategoria === "") return "No hay equipos registrados";
                  if (filtroGenero !== "" && filtroCategoria === "") return `No hay equipos registrados para ${filtroGenero}`;
                  if (filtroGenero === "" && filtroCategoria !== "") return `No hay equipos en la categoría "${filtroCategoria}"`;
                  return `No hay equipos ${filtroGenero} en la categoría "${filtroCategoria}"`;
                })()}
              </h3>
              <p>
                {(() => {
                  if (filtroGenero === "" && filtroCategoria === "") return "Crea el primer equipo para comenzar el torneo";
                  return "Selecciona otros filtros o crea un equipo con estas características";
                })()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección de gestión de jugadores */}
      <div className="players-management-section" style={{background:'white', borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.1)', padding:'2rem 1.5rem', marginBottom:32}}>
        <h2 className="section-title">
          <span className="section-icon">👤</span>
          Gestión de Jugadores
        </h2>

        {/* Importar jugadores desde Excel */}
        <div style={{marginBottom:'2rem', padding:'1.5rem', background:'#f8f9fa', borderRadius:'12px', border:'1px solid #e9ecef'}}>
          <h3 style={{margin:'0 0 1rem 0', color:'#495057', fontSize:'1.1rem'}}>
            📂 Importar Jugadores desde Excel
          </h3>
          <div style={{marginBottom:'1rem'}}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importarJugadores}
              style={{
                padding:'0.5rem',
                border:'1px solid #ced4da',
                borderRadius:'6px',
                background:'white'
              }}
            />
          </div>
          <div style={{fontSize:'0.9em', color:'#6c757d'}}>
            <strong>Estructura requerida del archivo Excel:</strong>
            <ul style={{margin:'0.5rem 0', paddingLeft:'1.5rem'}}>
              <li><strong>nombre:</strong> Nombre completo del jugador</li>
              <li><strong>curso:</strong> Curso del estudiante (ej: 1ro BGU)</li>
              <li><strong>paralelo:</strong> Paralelo (ej: A, B, C)</li>
              <li><strong>categoria:</strong> Categoría que debe existir previamente</li>
              <li><strong>genero:</strong> "Hombre" o "Mujer" (debe coincidir con la categoría)</li>
            </ul>
          </div>
        </div>



        {/* Seleccionar equipo para gestionar jugadores */}
        <div style={{marginBottom:'2rem'}}>
          <h3 style={{margin:'0 0 1rem 0', color:'#495057', fontSize:'1.1rem'}}>
            🏆 Seleccionar Equipo para Gestionar
          </h3>
          <select
            value={equipoSeleccionado ? `${equipoSeleccionado.curso}-${equipoSeleccionado.paralelo}-${equipoSeleccionado.categoria}-${equipoSeleccionado.genero || ''}` : ""}
            onChange={(e) => {
              if (e.target.value) {
                const [curso, paralelo, categoria, genero] = e.target.value.split('-');
                const equipo = equipos.find(eq => 
                  eq.curso === curso && 
                  eq.paralelo === paralelo && 
                  eq.categoria === categoria &&
                  (eq.genero || '') === genero
                );
                setEquipoSeleccionado(equipo);
              } else {
                setEquipoSeleccionado(null);
                setJugadores([]);
              }
            }}
            className="modern-input"
            style={{minWidth: '300px', maxWidth: '500px'}}
          >
            <option value="">Selecciona un equipo</option>
            {equipos.map(equipo => (
              <option key={equipo.id} value={`${equipo.curso}-${equipo.paralelo}-${equipo.categoria}-${equipo.genero || ''}`}>
                {equipo.genero ? `${equipo.genero} - ` : ''}{equipo.curso} {equipo.paralelo} - {equipo.categoria} ({equipo.grupo || 'Sin grupo'})
              </option>
            ))}
          </select>
        </div>

        {/* Lista de jugadores del equipo seleccionado */}
        {equipoSeleccionado && (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
              <h3 style={{margin:0, color:'#495057', fontSize:'1.1rem'}}>
                👥 Jugadores de {equipoSeleccionado.genero} - {equipoSeleccionado.curso} {equipoSeleccionado.paralelo} - {equipoSeleccionado.categoria}
              </h3>
              <span style={{background:'#e3f2fd', color:'#1565c0', padding:'0.25rem 0.75rem', borderRadius:'12px', fontSize:'0.9rem'}}>
                {jugadores.length} jugador{jugadores.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Formulario rápido para agregar jugador */}
            <div style={{
              marginBottom:'1.5rem', 
              padding:'1rem', 
              background:'#e8f5e8', 
              borderRadius:'8px', 
              border:'1px solid #c3e6c3'
            }}>
              <div style={{display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap'}}>
                <span style={{fontSize:'0.9rem', fontWeight:'500', color:'#2d5a2d'}}>
                  ➕ Agregar jugador:
                </span>
                <input
                  type="text"
                  placeholder="Nombre del jugador"
                  value={nuevoJugador.nombre}
                  onChange={(e) => setNuevoJugador({...nuevoJugador, nombre: e.target.value})}
                  className="modern-input"
                  style={{
                    margin:0,
                    minWidth:'200px',
                    maxWidth:'300px',
                    flex:'1'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && nuevoJugador.nombre.trim()) {
                      crearJugador();
                    }
                  }}
                />
                <button 
                  onClick={crearJugador}
                  disabled={!nuevoJugador.nombre.trim()}
                  style={{
                    backgroundColor: !nuevoJugador.nombre.trim() ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: !nuevoJugador.nombre.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    opacity: !nuevoJugador.nombre.trim() ? 0.5 : 1
                  }}
                >
                  ➕ Agregar
                </button>
              </div>
              <div style={{fontSize:'0.8rem', color:'#666', marginTop:'0.5rem'}}>
                Se agregará a: {equipoSeleccionado.genero} - {equipoSeleccionado.categoria} - {equipoSeleccionado.curso} {equipoSeleccionado.paralelo}
              </div>
            </div>

            {jugadores.length > 0 ? (
              <div className="players-table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{padding:'0.75rem', background:'#f8f9fa', borderBottom:'2px solid #dee2e6'}}>
                        Nombre
                      </th>
                      <th style={{padding:'0.75rem', background:'#f8f9fa', borderBottom:'2px solid #dee2e6'}}>
                        Curso
                      </th>
                      <th style={{padding:'0.75rem', background:'#f8f9fa', borderBottom:'2px solid #dee2e6'}}>
                        Número
                      </th>
                      <th style={{padding:'0.75rem', background:'#f8f9fa', borderBottom:'2px solid #dee2e6'}}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...jugadores]
                      .sort((a, b) => (a.numero || 999) - (b.numero || 999))
                      .map((jugador) => (
                        <tr key={jugador.id}>
                          <td style={{padding:'0.75rem', borderBottom:'1px solid #dee2e6'}}>
                            {jugadorAEditar === jugador.id ? (
                              <input
                                type="text"
                                value={jugador.nombre}
                                onChange={(e) => {
                                  const updatedJugadores = jugadores.map(j => 
                                    j.id === jugador.id ? {...j, nombre: e.target.value} : j
                                  );
                                  setJugadores(updatedJugadores);
                                }}
                                className="modern-input"
                                style={{margin:0, minWidth:'150px'}}
                              />
                            ) : (
                              jugador.nombre
                            )}
                          </td>
                          <td style={{padding:'0.75rem', borderBottom:'1px solid #dee2e6'}}>
                            {jugadorAEditar === jugador.id ? (
                              <div style={{display:'flex', gap:'0.5rem'}}>
                                <input
                                  type="text"
                                  value={jugador.curso}
                                  onChange={(e) => {
                                    const updatedJugadores = jugadores.map(j => 
                                      j.id === jugador.id ? {...j, curso: e.target.value} : j
                                    );
                                    setJugadores(updatedJugadores);
                                  }}
                                  className="modern-input"
                                  style={{margin:0, minWidth:'80px'}}
                                  placeholder="Curso"
                                />
                                <input
                                  type="text"
                                  value={jugador.paralelo}
                                  onChange={(e) => {
                                    const updatedJugadores = jugadores.map(j => 
                                      j.id === jugador.id ? {...j, paralelo: e.target.value} : j
                                    );
                                    setJugadores(updatedJugadores);
                                  }}
                                  className="modern-input"
                                  style={{margin:0, minWidth:'50px'}}
                                  placeholder="Par."
                                />
                              </div>
                            ) : (
                              `${jugador.curso} ${jugador.paralelo}`
                            )}
                          </td>
                          <td style={{padding:'0.75rem', borderBottom:'1px solid #dee2e6'}}>
                            {jugadorEditando === jugador.id ? (
                              <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  value={numeroAsignar}
                                  onChange={(e) => setNumeroAsignar(e.target.value)}
                                  placeholder="Núm."
                                  style={{
                                    width:'60px',
                                    padding:'0.25rem',
                                    border:'1px solid #ced4da',
                                    borderRadius:'4px'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => asignarNumero(jugador.id, numeroAsignar)}
                                  style={{
                                    background:'#28a745',
                                    color:'white',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.5rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setJugadorEditando(null);
                                    setNumeroAsignar("");
                                  }}
                                  style={{
                                    background:'#dc3545',
                                    color:'white',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.5rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span style={{
                                display:'inline-block',
                                minWidth:'30px',
                                padding:'0.25rem 0.5rem',
                                background: jugador.numero ? '#28a745' : '#6c757d',
                                color:'white',
                                borderRadius:'12px',
                                fontSize:'0.9rem',
                                textAlign:'center'
                              }}>
                                {jugador.numero || '-'}
                              </span>
                            )}
                          </td>
                          <td style={{padding:'0.75rem', borderBottom:'1px solid #dee2e6'}}>
                            {jugadorAEditar === jugador.id ? (
                              // Botones de guardar/cancelar edición
                              <div style={{display:'flex', gap:'0.5rem'}}>
                                <button
                                  onClick={() => actualizarJugador(jugador.id, {
                                    nombre: jugador.nombre,
                                    curso: jugador.curso,
                                    paralelo: jugador.paralelo
                                  })}
                                  style={{
                                    background:'#28a745',
                                    color:'white',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.75rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                  title="Guardar cambios"
                                >
                                  💾 Guardar
                                </button>
                                <button
                                  onClick={() => {
                                    setJugadorAEditar(null);
                                    obtenerJugadores(); // Recargar para revertir cambios
                                  }}
                                  style={{
                                    background:'#6c757d',
                                    color:'white',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.75rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                  title="Cancelar edición"
                                >
                                  ✕ Cancelar
                                </button>
                              </div>
                            ) : (
                              // Botones de acción normal
                              <div style={{display:'flex', gap:'0.5rem'}}>
                                {jugadorEditando === jugador.id ? null : (
                                  <button
                                    onClick={() => {
                                      setJugadorEditando(jugador.id);
                                      setNumeroAsignar(jugador.numero || "");
                                    }}
                                    style={{
                                      background:'#007bff',
                                      color:'white',
                                      border:'none',
                                      borderRadius:'4px',
                                      padding:'0.25rem 0.75rem',
                                      fontSize:'0.8rem',
                                      cursor:'pointer'
                                    }}
                                    title="Asignar/Cambiar número"
                                  >
                                    {jugador.numero ? '✏️ Núm.' : '📝 Núm.'}
                                  </button>
                                )}
                                <button
                                  onClick={() => setJugadorAEditar(jugador.id)}
                                  style={{
                                    background:'#ffc107',
                                    color:'#212529',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.75rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                  title="Editar jugador"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => eliminarJugador(jugador.id, jugador.nombre)}
                                  style={{
                                    background:'#dc3545',
                                    color:'white',
                                    border:'none',
                                    borderRadius:'4px',
                                    padding:'0.25rem 0.75rem',
                                    fontSize:'0.8rem',
                                    cursor:'pointer'
                                  }}
                                  title="Eliminar jugador"
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                textAlign:'center',
                padding:'2rem',
                color:'#6c757d',
                background:'#f8f9fa',
                borderRadius:'8px',
                border:'1px dashed #dee2e6'
              }}>
                <div style={{fontSize:'2rem', marginBottom:'0.5rem'}}>👥</div>
                <p style={{margin:0}}>No hay jugadores registrados para este equipo</p>
                <p style={{margin:'0.5rem 0 0 0', fontSize:'0.9rem'}}>
                  Importa un archivo Excel con los jugadores
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
