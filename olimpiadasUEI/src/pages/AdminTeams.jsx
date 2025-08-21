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
import "../styles/AdminTeams.css";

export default function AdminTeams() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  
  // Agregar estilo CSS para animaciones
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes slideInFromRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);
  
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
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [nivelesEducacionales, setNivelesEducacionales] = useState([]);
  const [nuevoNivelEducacional, setNuevoNivelEducacional] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_categoria') || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_nivel_educacional') || "";
  });
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_genero') || "";
  });

  // Estados de filtros independientes para el selector de equipos
  const [filtroGeneroSelector, setFiltroGeneroSelector] = useState("");
  const [filtroNivelEducacionalSelector, setFiltroNivelEducacionalSelector] = useState("");
  const [filtroCategoriaSelector, setFiltroCategoriaSelector] = useState("");

  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [nuevoNombreCategoria, setNuevoNombreCategoria] = useState("");
  const [nivelEducacionalEditando, setNivelEducacionalEditando] = useState(null);
  const [nuevoNombreNivelEducacional, setNuevoNombreNivelEducacional] = useState("");
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
  const [mostrarProgreso, setMostrarProgreso] = useState(false);
  const [progresoMensajes, setProgresoMensajes] = useState([]);
  const [passwordAdmin, setPasswordAdmin] = useState("");
  const [modalPassword, setModalPassword] = useState({ mostrar: false, callback: null });
  const [modalConfirmacion, setModalConfirmacion] = useState({ mostrar: false, titulo: '', mensaje: '', callback: null });
  const [modalAlerta, setModalAlerta] = useState({ mostrar: false, titulo: '', mensaje: '', tipo: 'info' });
  const [modalTexto, setModalTexto] = useState({ mostrar: false, titulo: '', mensaje: '', textoEsperado: '', callback: null });
  const [inputPassword, setInputPassword] = useState("");
  const [inputTexto, setInputTexto] = useState("");
  
  // Funciones de utilidad para modales personalizados
  const mostrarModalAlerta = (titulo, mensaje, tipo = 'info') => {
    setModalAlerta({ mostrar: true, titulo, mensaje, tipo });
    setTimeout(() => {
      setModalAlerta({ mostrar: false, titulo: '', mensaje: '', tipo: 'info' });
    }, 4000);
  };

  const mostrarModalConfirmacion = (titulo, mensaje, callback) => {
    setModalConfirmacion({ mostrar: true, titulo, mensaje, callback });
  };

  const mostrarModalPassword = (callback) => {
    setInputPassword("");
    setModalPassword({ mostrar: true, callback });
  };

  const mostrarModalTexto = (titulo, mensaje, textoEsperado, callback) => {
    setInputTexto("");
    setModalTexto({ mostrar: true, titulo, mensaje, textoEsperado, callback });
  };

  const cerrarModalPassword = () => {
    setModalPassword({ mostrar: false, callback: null });
    setInputPassword("");
  };

  const cerrarModalTexto = () => {
    setModalTexto({ mostrar: false, titulo: '', mensaje: '', textoEsperado: '', callback: null });
    setInputTexto("");
  };

  const cerrarModalConfirmacion = () => {
    setModalConfirmacion({ mostrar: false, titulo: '', mensaje: '', callback: null });
  };
  const agregarMensajeProgreso = (mensaje) => {
    setProgresoMensajes(prev => {
      const nuevos = [...prev, mensaje];
      // Mantener solo los últimos 5 mensajes
      return nuevos.slice(-5);
    });
    
    // Eliminar el mensaje después de 3 segundos
    setTimeout(() => {
      setProgresoMensajes(prev => prev.filter(m => m !== mensaje));
    }, 3000);
  };

  // Funciones para manejar filtros persistentes
  const handleFiltroGeneroChange = (genero) => {
    setFiltroGenero(genero);
    if (genero) {
      localStorage.setItem('olimpiadas_filtro_genero', genero);
    } else {
      localStorage.removeItem('olimpiadas_filtro_genero');
    }
  };

  const handleFiltroNivelEducacionalChange = (nivelEducacional) => {
    setFiltroNivelEducacional(nivelEducacional);
    if (nivelEducacional) {
      localStorage.setItem('olimpiadas_filtro_nivel_educacional', nivelEducacional);
    } else {
      localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
    }
  };

  const handleFiltroCategoriaChange = (categoria) => {
    setFiltroCategoria(categoria);
    if (categoria) {
      localStorage.setItem('olimpiadas_filtro_categoria', categoria);
    } else {
      localStorage.removeItem('olimpiadas_filtro_categoria');
    }
  };

  // Función específica para manejar cambios de categoría en el selector de equipos
  const handleFiltroCategoriaChangeSelector = (categoria) => {
    setFiltroCategoriaSelector(categoria);
  };



  const validarPasswordAdmin = () => {
    return new Promise((resolve) => {
      mostrarModalPassword(async (password) => {
        try {
          // Obtener el email del usuario actual de localStorage
          const userEmail = localStorage.getItem('userEmail');
          
          if (!userEmail) {
            mostrarModalAlerta("❌ Error", "No se encontró información del usuario. Por favor, inicia sesión nuevamente.", "error");
            resolve(false);
            return;
          }

          if (!password) {
            resolve(false);
            return;
          }

          // Intentar autenticar con Firebase
          try {
            await signInWithEmailAndPassword(auth, userEmail, password);
            mostrarModalAlerta("✅ Autenticado", "Contraseña verificada correctamente.", "success");
            resolve(true);
          } catch (authError) {
            console.error("Error de autenticación:", authError);
            
            let mensajeError = "❌ Contraseña incorrecta.";
            
            switch (authError.code) {
              case 'auth/wrong-password':
                mensajeError = "Contraseña incorrecta. Verifica e intenta nuevamente.";
                break;
              case 'auth/too-many-requests':
                mensajeError = "Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente.";
                break;
              case 'auth/user-not-found':
                mensajeError = "Usuario no encontrado. Contacta al administrador del sistema.";
                break;
              case 'auth/invalid-email':
                mensajeError = "Email inválido. Contacta al administrador del sistema.";
                break;
              default:
                mensajeError = `Error de autenticación: ${authError.message}`;
            }
            
            mostrarModalAlerta("❌ Error de Autenticación", mensajeError, "error");
            resolve(false);
          }
          
        } catch (error) {
          console.error("Error en validación de contraseña:", error);
          mostrarModalAlerta("❌ Error", "Error interno. Contacta al administrador del sistema.", "error");
          resolve(false);
        }
      });
    });
  };

  // Función para eliminar todos los jugadores de un equipo
  const eliminarEquipoCompleto = async (equipo) => {
    const passwordValida = await validarPasswordAdmin();
    if (!passwordValida) {
      return;
    }

    mostrarModalConfirmacion(
      "⚠️ Eliminar Equipo Completo",
      `¿Estás completamente seguro de eliminar TODOS los jugadores del equipo ${equipo.curso} ${equipo.paralelo} (${equipo.genero} - ${equipo.categoria})?\n\nEsta acción NO se puede deshacer.`,
      async (confirmar) => {
        if (!confirmar) return;

        try {
          setMostrarProgreso(true);
          agregarMensajeProgreso("🗑️ Iniciando eliminación del equipo...");

          const q = query(
            collection(db, "jugadores"),
            where("disciplina", "==", discipline),
            where("curso", "==", equipo.curso),
            where("paralelo", "==", equipo.paralelo),
            where("categoria", "==", equipo.categoria),
            where("genero", "==", equipo.genero)
          );
          
          const snapshot = await getDocs(q);
          const jugadoresAEliminar = snapshot.docs;

          agregarMensajeProgreso(`📋 Encontrados ${jugadoresAEliminar.length} jugadores para eliminar`);

          for (let i = 0; i < jugadoresAEliminar.length; i++) {
            await deleteDoc(jugadoresAEliminar[i].ref);
            if ((i + 1) % 5 === 0) {
              agregarMensajeProgreso(`🗑️ Eliminados ${i + 1}/${jugadoresAEliminar.length} jugadores`);
            }
          }

          // Eliminar el equipo también
          await deleteDoc(doc(db, "equipos", equipo.id));
          
          agregarMensajeProgreso("✅ Equipo eliminado completamente");
          mostrarModalAlerta("🎉 Eliminación Exitosa", `Se eliminaron ${jugadoresAEliminar.length} jugadores y el equipo ${equipo.curso} ${equipo.paralelo}`, "success");
          
          await obtenerEquipos();
          await obtenerJugadores();
          setMostrarProgreso(false);
          
        } catch (error) {
          console.error("Error eliminando equipo:", error);
          mostrarModalAlerta("❌ Error", "Error al eliminar el equipo: " + error.message, "error");
          setMostrarProgreso(false);
        }
      }
    );
  };

  // Función para eliminar todos los jugadores de una categoría
  const eliminarCategoriaCompleta = async (categoria, genero) => {
    const passwordValida = await validarPasswordAdmin();
    if (!passwordValida) {
      return;
    }

    mostrarModalConfirmacion(
      "⚠️ Eliminar Categoría Completa",
      `¿Estás completamente seguro de eliminar TODA la categoría "${categoria}" (${genero})?\n\nEsto eliminará TODOS los equipos y jugadores de esta categoría.\n\nEsta acción NO se puede deshacer.`,
      async (confirmado) => {
        if (!confirmado) return;
        await ejecutarEliminacionCategoria(categoria, genero);
      }
    );
  };

  const ejecutarEliminacionCategoria = async (categoria, genero) => {
    try {
      setMostrarProgreso(true);
      agregarMensajeProgreso("🗑️ Iniciando eliminación de categoría...");

      // Eliminar jugadores
      const qJugadores = query(
        collection(db, "jugadores"),
        where("disciplina", "==", discipline),
        where("categoria", "==", categoria),
        where("genero", "==", genero)
      );
      
      const jugadoresSnapshot = await getDocs(qJugadores);
      agregarMensajeProgreso(`📋 Encontrados ${jugadoresSnapshot.docs.length} jugadores`);

      for (let i = 0; i < jugadoresSnapshot.docs.length; i++) {
        await deleteDoc(jugadoresSnapshot.docs[i].ref);
        if ((i + 1) % 10 === 0) {
          agregarMensajeProgreso(`🗑️ Eliminados ${i + 1}/${jugadoresSnapshot.docs.length} jugadores`);
        }
      }

      // Eliminar equipos
      const qEquipos = query(
        collection(db, "equipos"),
        where("disciplina", "==", discipline),
        where("categoria", "==", categoria),
        where("genero", "==", genero)
      );
      
      const equiposSnapshot = await getDocs(qEquipos);
      agregarMensajeProgreso(`📋 Eliminando ${equiposSnapshot.docs.length} equipos`);

      for (const equipoDoc of equiposSnapshot.docs) {
        await deleteDoc(equipoDoc.ref);
      }

      // Eliminar categoría
      const categoriaDoc = categorias.find(c => c.nombre === categoria && c.genero === genero);
      if (categoriaDoc) {
        await deleteDoc(doc(db, "categorias", categoriaDoc.id));
      }
      
      agregarMensajeProgreso("✅ Categoría eliminada completamente");
      mostrarModalAlerta("🎉 Eliminación Exitosa", `Categoría "${categoria}" (${genero}) eliminada completamente`, "success");
      
      await obtenerCategorias();
      await obtenerEquipos();
      await obtenerJugadores();
      setMostrarProgreso(false);
      
    } catch (error) {
      console.error("Error eliminando categoría:", error);
      mostrarModalAlerta("❌ Error", "Error al eliminar la categoría: " + error.message, "error");
      setMostrarProgreso(false);
    }
  };

  // Función para eliminar TODOS los datos de la disciplina
  const eliminarTodosDatos = async () => {
    console.log("🚀 INICIANDO eliminarTodosDatos");
    try {
      const passwordValida = await validarPasswordAdmin();
      console.log("🔐 Password válida:", passwordValida);
      if (!passwordValida) {
        console.log("❌ Password inválida, abortando");
        return;
      }

      console.log("📝 Mostrando primer modal de confirmación");
      mostrarModalConfirmacion(
        "⚠️ PELIGRO: Eliminación Total",
        `¿Estás seguro de eliminar TODOS los datos de ${discipline.toUpperCase()}?\n\nEsto eliminará:\n- Todas las categorías\n- Todos los equipos\n- Todos los jugadores\n- Todos los grupos\n\nEsta acción NO se puede deshacer.`,
        (confirmado) => {
          console.log("✅ Primer callback ejecutado, confirmado:", confirmado);
          if (!confirmado) {
            console.log("❌ Primera confirmación cancelada");
            return;
          }
          
          // Usar setTimeout para asegurar que el primer modal se cierre antes de mostrar el segundo
          setTimeout(() => {
            console.log("📝 Mostrando segundo modal de confirmación");
            mostrarModalConfirmacion(
              "🚨 ÚLTIMA CONFIRMACIÓN",
              `¿Realmente quieres BORRAR TODO de ${discipline.toUpperCase()}?\n\nEsta es tu última oportunidad para cancelar.`,
              async (confirmado2) => {
                console.log("✅ Segundo callback ejecutado, confirmado2:", confirmado2);
                if (!confirmado2) {
                  console.log("❌ Segunda confirmación cancelada");
                  return;
                }
                
                console.log("🚀 Ejecutando eliminación total...");
                await ejecutarEliminacionTotal();
              }
            );
          }, 100);
        }
      );
    } catch (error) {
      console.error("💥 Error en eliminarTodosDatos:", error);
      mostrarModalAlerta("❌ Error", "Error inesperado: " + error.message, "error");
    }
  };

  const ejecutarEliminacionTotal = async () => {
    console.log("🚀 INICIANDO ejecutarEliminacionTotal");
    try {
      console.log("📊 Configurando modal de progreso...");
      setMostrarProgreso(true);
      agregarMensajeProgreso("🗑️ Iniciando eliminación total...");

      console.log("🔍 Buscando jugadores...");
      // Eliminar jugadores
      const qJugadores = query(collection(db, "jugadores"), where("disciplina", "==", discipline));
      const jugadoresSnapshot = await getDocs(qJugadores);
      console.log("📋 Jugadores encontrados:", jugadoresSnapshot.docs.length);
      agregarMensajeProgreso(`📋 Encontrados ${jugadoresSnapshot.docs.length} jugadores`);

      for (let i = 0; i < jugadoresSnapshot.docs.length; i++) {
        await deleteDoc(jugadoresSnapshot.docs[i].ref);
        if ((i + 1) % 10 === 0) {
          agregarMensajeProgreso(`🗑️ Eliminados ${i + 1}/${jugadoresSnapshot.docs.length} jugadores`);
        }
      }

      console.log("🔍 Buscando equipos...");
      // Eliminar equipos
      const qEquipos = query(collection(db, "equipos"), where("disciplina", "==", discipline));
      const equiposSnapshot = await getDocs(qEquipos);
      console.log("📋 Equipos encontrados:", equiposSnapshot.docs.length);
      agregarMensajeProgreso(`📋 Eliminando ${equiposSnapshot.docs.length} equipos`);

      for (const equipoDoc of equiposSnapshot.docs) {
        await deleteDoc(equipoDoc.ref);
      }

      console.log("🔍 Buscando categorías...");
      // Eliminar categorías
      const qCategorias = query(collection(db, "categorias"), where("disciplina", "==", discipline));
      const categoriasSnapshot = await getDocs(qCategorias);
      console.log("📋 Categorías encontradas:", categoriasSnapshot.docs.length);
      agregarMensajeProgreso(`📋 Eliminando ${categoriasSnapshot.docs.length} categorías`);

      for (const categoriaDoc of categoriasSnapshot.docs) {
        await deleteDoc(categoriaDoc.ref);
      }
      
      console.log("✅ Eliminación completada");
      agregarMensajeProgreso("✅ Eliminación total completada");
      mostrarModalAlerta("🎉 Eliminación Total Exitosa", `Todos los datos de ${discipline} han sido eliminados`, "success");
      
      console.log("🔄 Actualizando datos...");
      await obtenerCategorias();
      await obtenerEquipos();
      await obtenerJugadores();
      setMostrarProgreso(false);
      
    } catch (error) {
      console.error("💥 Error eliminando todos los datos:", error);
      mostrarModalAlerta("❌ Error", "Error en la eliminación total: " + error.message, "error");
      setMostrarProgreso(false);
    }
  };
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

  // Obtener niveles educacionales desde Firestore
  const obtenerNivelesEducacionales = async () => {
    const q = query(
      collection(db, "nivelesEducacionales"),
      where("disciplina", "==", discipline)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setNivelesEducacionales(data);
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

  // Función para limpiar duplicados de niveles educacionales
  const limpiarDuplicadosNivelesEducacionales = async () => {
    try {
      console.log("🧹 Iniciando limpieza de duplicados de niveles educacionales...");
      mostrarModalAlerta("🧹 Limpiando duplicados", "Iniciando limpieza de niveles educacionales duplicados...", "info");
      
      const q = query(
        collection(db, "nivelesEducacionales"),
        where("disciplina", "==", discipline)
      );
      const snapshot = await getDocs(q);
      const niveles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Total de niveles encontrados: ${niveles.length}`);
      
      // Agrupar por nombre (case-insensitive y sin espacios extra)
      const nivelesAgrupados = niveles.reduce((acc, nivel) => {
        const key = nivel.nombre.toLowerCase().trim();
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(nivel);
        return acc;
      }, {});
      
      let duplicadosEliminados = 0;
      
      // Eliminar duplicados (mantener solo el primero de cada grupo)
      for (const [nombre, grupoNiveles] of Object.entries(nivelesAgrupados)) {
        if (grupoNiveles.length > 1) {
          console.log(`🗑️ Encontrados ${grupoNiveles.length} duplicados para "${nombre}"`);
          
          // Mantener el primero, eliminar el resto
          for (let i = 1; i < grupoNiveles.length; i++) {
            await deleteDoc(doc(db, "nivelesEducacionales", grupoNiveles[i].id));
            console.log(`   ✓ Eliminado duplicado: ${grupoNiveles[i].id}`);
            duplicadosEliminados++;
          }
        }
      }
      
      console.log(`✅ Limpieza completada. ${duplicadosEliminados} duplicados eliminados`);
      
      if (duplicadosEliminados > 0) {
        mostrarModalAlerta("✅ Limpieza exitosa", `Se eliminaron ${duplicadosEliminados} niveles educacionales duplicados`, "success");
      } else {
        mostrarModalAlerta("ℹ️ Sin duplicados", "No se encontraron niveles educacionales duplicados", "info");
      }
      
      // Recargar los datos
      await cargarTodosDatos();
      
    } catch (error) {
      console.error("❌ Error al limpiar duplicados:", error);
      mostrarModalAlerta("❌ Error", "Error al limpiar duplicados: " + error.message, "error");
    }
  };

  // Estados adicionales para optimización
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Función optimizada para cargar todos los datos en paralelo
  const cargarTodosDatos = async () => {
    setCargandoDatos(true);
    setErrorCarga(null);
    
    try {
      // Cargar todos los datos en paralelo para mejor rendimiento
      const [equiposSnap, gruposSnap, categoriasSnap, nivelesSnap] = await Promise.all([
        getDocs(query(collection(db, "equipos"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "grupos"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "categorias"), where("disciplina", "==", discipline))),
        getDocs(query(collection(db, "nivelesEducacionales"), where("disciplina", "==", discipline)))
      ]);

      // Procesar datos
      const equiposData = equiposSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const gruposData = gruposSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const categoriasData = categoriasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nivelesData = nivelesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Actualizar estados
      setEquipos(equiposData);
      setGrupos(gruposData);
      setCategorias(categoriasData);
      setNivelesEducacionales(nivelesData);
      
      console.log("✅ Datos cargados:", {
        equipos: equiposData.length,
        grupos: gruposData.length,
        categorias: categoriasData.length,
        niveles: nivelesData.length
      });
      
      // Debug de niveles educacionales y equipos
      console.log("🎓 Niveles Educacionales:", nivelesData);
      console.log("👥 Equipos (primeros 3):", equiposData.slice(0, 3));
      
    } catch (error) {
      console.error("❌ Error al cargar datos:", error);
      setErrorCarga("Error al cargar los datos. Intenta recargar la página.");
      mostrarModalAlerta("❌ Error", "Error al cargar los datos. Intenta recargar la página.", "error");
    } finally {
      setCargandoDatos(false);
    }
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
    cargarTodosDatos();
  }, []);

  useEffect(() => {
    if (equipoSeleccionado) {
      obtenerJugadores();
    }
  }, [equipoSeleccionado]);

  // useEffect para deseleccionar equipo si no pasa los filtros actuales del selector
  useEffect(() => {
    if (equipoSeleccionado) {
      const pasaGenero = filtroGeneroSelector === "" || equipoSeleccionado.genero === filtroGeneroSelector;
      const pasaNivelEducacional = filtroNivelEducacionalSelector === "" || equipoSeleccionado.nivelEducacional === filtroNivelEducacionalSelector;
      const pasaCategoria = filtroCategoriaSelector === "" || equipoSeleccionado.categoria === filtroCategoriaSelector;
      
      if (!pasaGenero || !pasaNivelEducacional || !pasaCategoria) {
        setEquipoSeleccionado(null);
        setJugadores([]);
      }
    }
  }, [filtroGeneroSelector, filtroNivelEducacionalSelector, filtroCategoriaSelector, equipoSeleccionado]);

  const crearEquipo = async () => {
    if (!nuevoEquipo.curso || !nuevoEquipo.paralelo || !nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero) return;
    
    // Si el grupo no existe, agrégalo relacionado con la categoría, nivel educacional y género
    if (nuevoEquipo.grupo && !grupos.find(g => 
      g.nombre === nuevoEquipo.grupo && 
      g.categoria === nuevoEquipo.categoria && 
      g.nivelEducacional === nuevoEquipo.nivelEducacional &&
      g.genero === nuevoEquipo.genero
    )) {
      await addDoc(collection(db, "grupos"), {
        nombre: nuevoEquipo.grupo.trim(),
        categoria: nuevoEquipo.categoria,
        nivelEducacional: nuevoEquipo.nivelEducacional,
        genero: nuevoEquipo.genero,
        disciplina: discipline,
      });
      await obtenerGrupos();
      mostrarModalAlerta("✨ Grupo Creado", `Se creó automáticamente el grupo "${nuevoEquipo.grupo.trim()}" para ${nuevoEquipo.genero} - ${nuevoEquipo.nivelEducacional} - ${nuevoEquipo.categoria}`, "success");
    }
    
    await addDoc(collection(db, "equipos"), {
      ...nuevoEquipo,
      grupo: nuevoEquipo.grupo || "Sin grupo",
      disciplina: discipline,
    });
    setNuevoEquipo({ curso: "", paralelo: "", grupo: "", categoria: "", nivelEducacional: "", genero: "" });
    obtenerEquipos();
  };

  const eliminarGrupo = async (nombreGrupo, categoria, nivelEducacional, genero) => {
    const q = query(
      collection(db, "grupos"),
      where("disciplina", "==", discipline),
      where("nombre", "==", nombreGrupo),
      where("categoria", "==", categoria),
      where("nivelEducacional", "==", nivelEducacional),
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
    
    // Si se cambia la categoría, nivel educacional o género, también limpiar el grupo
    if (campo === "categoria" || campo === "nivelEducacional" || campo === "genero") {
      await updateDoc(ref, { 
        [campo]: valor,
        grupo: "" // Limpiar grupo al cambiar categoría, nivel educacional o género
      });
    } else if (campo === "grupo" && valor.trim()) {
      // Si se está actualizando el grupo, verificar si existe y crearlo si no
      const equipo = equipos.find(eq => eq.id === id);
      if (equipo) {
        const grupoExiste = grupos.find(g => 
          g.nombre === valor.trim() && 
          g.categoria === equipo.categoria && 
          g.nivelEducacional === equipo.nivelEducacional &&
          g.genero === equipo.genero
        );
        
        if (!grupoExiste) {
          // Crear el grupo automáticamente
          await addDoc(collection(db, "grupos"), {
            nombre: valor.trim(),
            categoria: equipo.categoria,
            nivelEducacional: equipo.nivelEducacional,
            genero: equipo.genero,
            disciplina: discipline,
          });
          await obtenerGrupos(); // Actualizar la lista de grupos
          mostrarModalAlerta("✨ Grupo Creado", `Se creó automáticamente el grupo "${valor.trim()}" para ${equipo.genero} - ${equipo.nivelEducacional} - ${equipo.categoria}`, "success");
        }
      }
      
      await updateDoc(ref, { [campo]: valor });
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
      mostrarModalAlerta("⚠️ No se puede eliminar", `No se puede eliminar la categoría "${categoriaNombre}" (${generoCategoria}) porque hay ${equiposConCategoria.length} equipo(s) asignado(s) a esta categoría.`, "error");
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

  // Función para eliminar nivel educacional
  const eliminarNivelEducacional = async (nivelEducacionalId, nivelEducacionalNombre) => {
    // Verificar si hay equipos usando este nivel educacional
    const equiposConNivel = equipos.filter(equipo => 
      equipo.nivelEducacional === nivelEducacionalNombre
    );
    if (equiposConNivel.length > 0) {
      mostrarModalAlerta("⚠️ No se puede eliminar", `No se puede eliminar el nivel educacional "${nivelEducacionalNombre}" porque hay ${equiposConNivel.length} equipo(s) asignado(s) a este nivel.`, "error");
      return;
    }

    // Eliminar categorías relacionadas con este nivel educacional
    const categoriasRelacionadas = categorias.filter(categoria => 
      categoria.nivelEducacional === nivelEducacionalNombre
    );
    for (const categoria of categoriasRelacionadas) {
      await deleteDoc(doc(db, "categorias", categoria.id));
    }

    // Eliminar grupos relacionados con este nivel educacional
    const gruposRelacionados = grupos.filter(grupo => 
      grupo.nivelEducacional === nivelEducacionalNombre
    );
    for (const grupo of gruposRelacionados) {
      await deleteDoc(doc(db, "grupos", grupo.id));
    }

    // Eliminar el nivel educacional
    await deleteDoc(doc(db, "nivelesEducacionales", nivelEducacionalId));
    
    // Actualizar datos
    cargarTodosDatos();
    
    // Limpiar filtro si se eliminó el nivel filtrado
    if (filtroNivelEducacional === nivelEducacionalNombre) {
      setFiltroNivelEducacional("");
    }
  };

  // Función para actualizar nivel educacional
  const actualizarNivelEducacional = async (nivelEducacionalId, nuevoNombre, nombreAnterior) => {
    // Actualizar el nivel educacional
    const ref = doc(db, "nivelesEducacionales", nivelEducacionalId);
    await updateDoc(ref, { nombre: nuevoNombre });

    // Actualizar todos los equipos que tenían el nivel anterior
    const equiposConNivel = equipos.filter(equipo => 
      equipo.nivelEducacional === nombreAnterior
    );
    for (const equipo of equiposConNivel) {
      const equipoRef = doc(db, "equipos", equipo.id);
      await updateDoc(equipoRef, { nivelEducacional: nuevoNombre });
    }

    // Actualizar todas las categorías que tenían el nivel anterior
    const categoriasConNivel = categorias.filter(categoria => 
      categoria.nivelEducacional === nombreAnterior
    );
    for (const categoria of categoriasConNivel) {
      const categoriaRef = doc(db, "categorias", categoria.id);
      await updateDoc(categoriaRef, { nivelEducacional: nuevoNombre });
    }

    // Actualizar todos los grupos que tenían el nivel anterior
    const gruposConNivel = grupos.filter(grupo => 
      grupo.nivelEducacional === nombreAnterior
    );
    for (const grupo of gruposConNivel) {
      const grupoRef = doc(db, "grupos", grupo.id);
      await updateDoc(grupoRef, { nivelEducacional: nuevoNombre });
    }

    // Actualizar filtro si estaba usando el nivel anterior
    if (filtroNivelEducacional === nombreAnterior) {
      setFiltroNivelEducacional(nuevoNombre);
    }

    // Refrescar datos
    cargarTodosDatos();
    
    // Limpiar estado de edición
    setNivelEducacionalEditando(null);
    setNuevoNombreNivelEducacional("");
  };

  // Función para asignar número a jugador
  const asignarNumero = async (jugadorId, numero) => {
    if (!numero || numero < 1 || numero > 99) {
      mostrarModalAlerta("⚠️ Número inválido", "El número debe estar entre 1 y 99", "error");
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
      mostrarModalAlerta("⚠️ Número duplicado", `El número ${numero} ya está asignado a otro jugador de este equipo`, "error");
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
      mostrarModalAlerta("❌ Error", "Error al asignar número", "error");
    }
  };

  // Función auxiliar para crear nivel educacional si no existe
  const crearNivelEducacionalAutomatico = async (nombreNivelEducacional) => {
    const nivelExiste = nivelesEducacionales.find(nivel => 
      nivel.nombre.toLowerCase().trim() === nombreNivelEducacional.toLowerCase().trim()
    );
    
    if (!nivelExiste) {
      console.log(`🆕 Creando nivel educacional automáticamente: ${nombreNivelEducacional}`);
      await addDoc(collection(db, "nivelesEducacionales"), {
        nombre: nombreNivelEducacional.trim(),
        disciplina: discipline,
        fechaCreacion: new Date().toISOString()
      });
      
      // Actualizar la lista local de niveles educacionales
      await cargarTodosDatos();
      return true;
    }
    return false;
  };

  // Función auxiliar para crear categoría si no existe
  const crearCategoriaAutomatica = async (nombreCategoria, nivelEducacional, genero) => {
    const categoriaExiste = categorias.find(cat => 
      cat.nombre === nombreCategoria && 
      cat.nivelEducacional === nivelEducacional && 
      cat.genero === genero
    );
    
    if (!categoriaExiste) {
      console.log(`🆕 Creando categoría automáticamente: ${nombreCategoria} (${nivelEducacional} - ${genero})`);
      await addDoc(collection(db, "categorias"), {
        nombre: nombreCategoria.trim(),
        nivelEducacional: nivelEducacional.trim(),
        genero: genero.trim(),
        disciplina: discipline,
        fechaCreacion: new Date().toISOString()
      });
      
      // Actualizar la lista local de categorías
      await obtenerCategorias();
      return true;
    }
    return false;
  };

  // Función auxiliar para crear grupo si no existe
  const crearGrupoAutomatico = async (nombreGrupo, categoria, nivelEducacional, genero) => {
    if (!nombreGrupo) return false; // Si no hay nombre de grupo, no hacer nada
    
    const grupoExiste = grupos.find(g => 
      g.nombre === nombreGrupo && 
      g.categoria === categoria && 
      g.nivelEducacional === nivelEducacional &&
      g.genero === genero
    );
    
    if (!grupoExiste) {
      console.log(`🏆 Creando grupo automáticamente: ${nombreGrupo} (${genero} - ${nivelEducacional} - ${categoria})`);
      await addDoc(collection(db, "grupos"), {
        nombre: nombreGrupo.trim(),
        categoria: categoria.trim(),
        nivelEducacional: nivelEducacional.trim(),
        genero: genero.trim(),
        disciplina: discipline,
        fechaCreacion: new Date().toISOString()
      });
      
      // Actualizar la lista local de grupos
      await obtenerGrupos();
      return true;
    }
    return false;
  };

  // Función auxiliar para crear equipo si no existe
  const crearEquipoAutomatico = async (curso, paralelo, categoria, nivelEducacional, genero, grupo = "") => {
    const equipoExiste = equipos.find(eq => 
      eq.curso === curso && 
      eq.paralelo === paralelo && 
      eq.categoria === categoria && 
      eq.nivelEducacional === nivelEducacional &&
      eq.genero === genero &&
      eq.grupo === grupo
    );
    
    if (!equipoExiste) {
      console.log(`🆕 Creando equipo automáticamente: ${curso} ${paralelo} (${genero} - ${nivelEducacional} - ${categoria}${grupo ? ` - Grupo: ${grupo}` : ''})`);
      await addDoc(collection(db, "equipos"), {
        curso: curso.trim(),
        paralelo: paralelo.trim(),
        categoria: categoria.trim(),
        nivelEducacional: nivelEducacional.trim(),
        genero: genero.trim(),
        grupo: grupo ? grupo.trim() : "", // Usar el grupo proporcionado o vacío
        disciplina: discipline,
        fechaCreacion: new Date().toISOString()
      });
      
      // Actualizar la lista local de equipos
      await obtenerEquipos();
      return true;
    }
    return false;
  };

  // Función para importar jugadores desde Excel con creación automática
  const importarJugadores = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setMostrarProgreso(true);
      agregarMensajeProgreso("📁 Leyendo archivo Excel...");

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        mostrarModalAlerta("⚠️ Archivo Vacío", "El archivo Excel está vacío o no tiene datos válidos.", "error");
        setMostrarProgreso(false);
        return;
      }

      agregarMensajeProgreso(`📊 Detectados ${jsonData.length} registros`);

      // Detectar y limpiar las columnas disponibles
      const primeraFila = jsonData[0];
      const columnasDisponibles = Object.keys(primeraFila);

      // Limpiar espacios en blanco de todas las filas
      const datosLimpios = jsonData.map(fila => {
        const filaLimpia = {};
        Object.keys(fila).forEach(columna => {
          const columnalimpia = columna.trim().toLowerCase();
          const valor = fila[columna];
          
          // Mapear columnas comunes
          if (columnalimpia.includes('nombre')) {
            filaLimpia.nombre = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('curso')) {
            filaLimpia.curso = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('paralelo')) {
            filaLimpia.paralelo = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('nivel') && (columnalimpia.includes('educacional') || columnalimpia.includes('educativo'))) {
            filaLimpia.nivelEducacional = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('categoria')) {
            filaLimpia.categoria = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('grupo')) {
            filaLimpia.grupo = valor ? valor.toString().trim() : '';
          } else if (columnalimpia.includes('genero') || columnalimpia.includes('género')) {
            filaLimpia.genero = valor ? valor.toString().trim() : '';
          }
        });
        return filaLimpia;
      });

      agregarMensajeProgreso("🧹 Datos procesados y validados");

      let importados = 0;
      let errores = [];
      let categoriasCreadas = 0;
      let equiposCreados = 0;
      const categoriasNuevas = new Set();
      const equiposNuevos = new Set();

      for (let i = 0; i < datosLimpios.length; i++) {
        const fila = datosLimpios[i];
        const { nombre, curso, paralelo, categoria, genero, nivelEducacional, grupo } = fila;

        // Verificar datos requeridos
        const datosIncompletos = [];
        if (!nombre) datosIncompletos.push('nombre');
        if (!curso) datosIncompletos.push('curso');
        if (!paralelo) datosIncompletos.push('paralelo');
        if (!categoria) datosIncompletos.push('categoria');
        if (!genero) datosIncompletos.push('genero');
        if (!nivelEducacional) datosIncompletos.push('nivel educacional');

        if (datosIncompletos.length > 0) {
          errores.push(`Fila ${i + 2}: Faltan datos: ${datosIncompletos.join(', ')}`);
          continue;
        }

        // Validar género
        const generoNormalizado = genero.toLowerCase();
        if (generoNormalizado !== 'hombre' && generoNormalizado !== 'mujer') {
          errores.push(`Fila ${i + 2}: Género inválido para ${nombre}. Debe ser "Hombre" o "Mujer"`);
          continue;
        }

        const generoFinal = generoNormalizado === 'hombre' ? 'Hombre' : 'Mujer';
        const cursoFinal = curso.toString().trim();
        const paraleloFinal = paralelo.toString().trim();
        const categoriaFinal = categoria.toString().trim();
        // Usar el nivel educacional del Excel, o valor por defecto si no está
        const nivelEducacionalFinal = nivelEducacional ? nivelEducacional.toString().trim() : "Escuela";
        // El grupo es opcional
        const grupoFinal = grupo ? grupo.toString().trim() : "";

        try {
          // 1. Crear nivel educacional automáticamente si no existe
          const nivelCreado = await crearNivelEducacionalAutomatico(nivelEducacionalFinal);
          if (nivelCreado) {
            agregarMensajeProgreso(`🏫 Nuevo nivel educacional: ${nivelEducacionalFinal}`);
          }

          // 2. Crear categoría automáticamente si no existe
          const categoriaKey = `${categoriaFinal}-${nivelEducacionalFinal}-${generoFinal}`;
          if (!categoriasNuevas.has(categoriaKey)) {
            const categoriaCreada = await crearCategoriaAutomatica(categoriaFinal, nivelEducacionalFinal, generoFinal);
            if (categoriaCreada) {
              categoriasCreadas++;
              categoriasNuevas.add(categoriaKey);
              agregarMensajeProgreso(`📂 Nueva categoría: ${categoriaFinal} (${nivelEducacionalFinal} - ${generoFinal})`);
            }
          }

          // 3. Crear grupo automáticamente si se especifica
          if (grupoFinal) {
            const grupoCreado = await crearGrupoAutomatico(grupoFinal, categoriaFinal, nivelEducacionalFinal, generoFinal);
            if (grupoCreado) {
              agregarMensajeProgreso(`🏆 Nuevo grupo: ${grupoFinal} (${categoriaFinal})`);
            }
          }

          // 4. Crear equipo automáticamente si no existe
          const equipoKey = `${cursoFinal}-${paraleloFinal}-${categoriaFinal}-${nivelEducacionalFinal}-${generoFinal}-${grupoFinal || 'sin-grupo'}`;
          if (!equiposNuevos.has(equipoKey)) {
            const equipoCreado = await crearEquipoAutomatico(cursoFinal, paraleloFinal, categoriaFinal, nivelEducacionalFinal, generoFinal, grupoFinal);
            if (equipoCreado) {
              equiposCreados++;
              equiposNuevos.add(equipoKey);
              agregarMensajeProgreso(`👥 Nuevo equipo: ${cursoFinal} ${paraleloFinal}${grupoFinal ? ` (Grupo: ${grupoFinal})` : ''}`);
            }
          }

          // 5. Verificar que no existe el jugador
          const jugadorExiste = jugadores.some(j => 
            j.nombre.toLowerCase() === nombre.toLowerCase() &&
            j.curso === cursoFinal &&
            j.paralelo === paraleloFinal &&
            j.categoria === categoriaFinal &&
            j.nivelEducacional === nivelEducacionalFinal &&
            j.genero === generoFinal &&
            (j.grupo || "") === grupoFinal
          );

          if (jugadorExiste) {
            errores.push(`Fila ${i + 2}: Jugador "${nombre}" ya existe`);
            continue;
          }

          // 6. Crear jugador
          await addDoc(collection(db, "jugadores"), {
            nombre: nombre,
            curso: cursoFinal,
            paralelo: paraleloFinal,
            categoria: categoriaFinal,
            nivelEducacional: nivelEducacionalFinal,
            grupo: grupoFinal,
            genero: generoFinal,
            disciplina: discipline,
            numero: null,
            fechaCreacion: new Date().toISOString()
          });

          importados++;
          if (importados % 10 === 0 || importados === datosLimpios.length) {
            agregarMensajeProgreso(`✅ Progreso: ${importados}/${datosLimpios.length} jugadores`);
          }

        } catch (error) {
          errores.push(`Fila ${i + 2}: Error al procesar ${nombre}: ${error.message}`);
        }
      }

      // Actualizar todas las listas
      await cargarTodosDatos();
      await obtenerJugadores();
      
      setMostrarProgreso(false);
      
      if (errores.length > 0) {
        mostrarModalAlerta("⚠️ Importación con Errores", `${importados} jugadores importados, pero ${errores.length} errores encontrados. Revisa la consola.`, "error");
        console.log("📋 Errores detallados:", errores);
      } else {
        mostrarModalAlerta("🎉 Importación Exitosa", `${importados} jugadores importados correctamente. ${categoriasCreadas} categorías y ${equiposCreados} equipos creados.`, "success");
      }
      
      event.target.value = '';
      
    } catch (error) {
      console.error("❌ Error al importar:", error);
      mostrarModalAlerta("❌ Error de Importación", error.message, "error");
      setMostrarProgreso(false);
    }
  };

  // Función para crear jugador manual
  const crearJugador = async () => {
    if (!equipoSeleccionado) {
      mostrarModalAlerta("⚠️ Equipo requerido", "Primero selecciona un equipo", "error");
      return;
    }

    if (!nuevoJugador.nombre.trim()) {
      mostrarModalAlerta("⚠️ Nombre requerido", "El nombre del jugador es obligatorio", "error");
      return;
    }

    // Verificar que no existe el jugador en este equipo
    const jugadorExiste = jugadores.some(j => 
      j.nombre.toLowerCase() === nuevoJugador.nombre.toLowerCase()
    );

    if (jugadorExiste) {
      mostrarModalAlerta("⚠️ Jugador duplicado", `El jugador "${nuevoJugador.nombre}" ya existe en este equipo`, "error");
      return;
    }

    try {
      await addDoc(collection(db, "jugadores"), {
        nombre: nuevoJugador.nombre.trim(),
        curso: equipoSeleccionado.curso,
        paralelo: equipoSeleccionado.paralelo,
        categoria: equipoSeleccionado.categoria,
        nivelEducacional: equipoSeleccionado.nivelEducacional,
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
        nivelEducacional: "",
        genero: ""
      });

      obtenerJugadores();
      mostrarModalAlerta("✅ Éxito", "Jugador creado exitosamente", "success");
    } catch (error) {
      console.error("Error al crear jugador:", error);
      mostrarModalAlerta("❌ Error", "Error al crear jugador", "error");
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
      mostrarModalAlerta("✅ Éxito", "Jugador actualizado exitosamente", "success");
    } catch (error) {
      console.error("Error al actualizar jugador:", error);
      mostrarModalAlerta("❌ Error", "Error al actualizar jugador", "error");
    }
  };

  // Función para eliminar jugador
  const eliminarJugador = async (jugadorId, nombreJugador) => {
    mostrarModalConfirmacion(
      "🗑️ Eliminar Jugador",
      `¿Estás seguro de eliminar al jugador "${nombreJugador}"?`,
      async (confirmado) => {
        if (!confirmado) return;
        try {
          await deleteDoc(doc(db, "jugadores", jugadorId));
          obtenerJugadores();
          mostrarModalAlerta("✅ Éxito", "Jugador eliminado exitosamente", "success");
        } catch (error) {
          console.error("Error al eliminar jugador:", error);
          mostrarModalAlerta("❌ Error", "Error al eliminar jugador", "error");
        }
      }
    );
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

  // Función de migración para agregar nivel educacional a equipos existentes
  const migrarEquiposConNivelEducacional = async () => {
    const confirmar = window.confirm(
      "🔄 Migración de Datos\n\n" +
      "Esta función actualizará todos los equipos sin nivel educacional asignándoles un nivel por defecto.\n\n" +
      "¿Deseas continuar?"
    );

    if (!confirmar) return;

    try {
      setMostrarProgreso(true);
      agregarMensajeProgreso("🔄 Iniciando migración de equipos...");

      // Obtener equipos sin nivel educacional
      const equiposSinNivel = equipos.filter(equipo => !equipo.nivelEducacional);
      
      if (equiposSinNivel.length === 0) {
        mostrarModalAlerta("✅ Migración completa", "Todos los equipos ya tienen nivel educacional asignado", "success");
        setMostrarProgreso(false);
        return;
      }

      agregarMensajeProgreso(`📊 Encontrados ${equiposSinNivel.length} equipos para migrar`);

      // Asignar nivel educacional por defecto basado en la categoría o crear uno genérico
      let equiposActualizados = 0;
      
      for (const equipo of equiposSinNivel) {
        try {
          // Determinar nivel educacional por defecto
          let nivelPorDefecto = "Escuela"; // Valor por defecto
          
          // Si hay categorías disponibles para este género, usar la primera
          const categoriaEquipo = categorias.find(cat => 
            cat.genero === equipo.genero && cat.nombre === equipo.categoria
          );
          
          if (categoriaEquipo && categoriaEquipo.nivelEducacional) {
            nivelPorDefecto = categoriaEquipo.nivelEducacional;
          } else {
            // Si no hay nivel en la categoría, crear uno por defecto si no existe
            const nivelExiste = nivelesEducacionales.find(nivel => 
              nivel.nombre === "Escuela" && nivel.genero === equipo.genero
            );
            
            if (!nivelExiste) {
              await addDoc(collection(db, "nivelesEducacionales"), {
                nombre: "Escuela",
                genero: equipo.genero,
                disciplina: discipline,
                fechaCreacion: new Date().toISOString()
              });
              await cargarTodosDatos(); // Actualizar lista
            }
          }

          // Actualizar el equipo con el nivel educacional
          const equipoRef = doc(db, "equipos", equipo.id);
          await updateDoc(equipoRef, {
            nivelEducacional: nivelPorDefecto
          });

          equiposActualizados++;
          agregarMensajeProgreso(`✅ Actualizado: ${equipo.curso} ${equipo.paralelo} → ${nivelPorDefecto}`);

        } catch (error) {
          console.error(`Error actualizando equipo ${equipo.id}:`, error);
          agregarMensajeProgreso(`❌ Error: ${equipo.curso} ${equipo.paralelo}`);
        }
      }

      // Actualizar listas
      await cargarTodosDatos();
      
      setMostrarProgreso(false);
      mostrarModalAlerta(
        "🎉 Migración Exitosa", 
        `Se actualizaron ${equiposActualizados} equipos con nivel educacional.`, 
        "success"
      );

    } catch (error) {
      console.error("Error en migración:", error);
      mostrarModalAlerta("❌ Error de Migración", error.message, "error");
      setMostrarProgreso(false);
    }
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

      {/* Indicador de carga optimizado */}
      {cargandoDatos && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196F3',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem 0',
          textAlign: 'center',
          color: '#1976D2'
        }}>
          <div style={{ fontSize: '1.2em', marginBottom: '0.5rem' }}>⏳ Cargando datos...</div>
          <div style={{ fontSize: '0.9em' }}>Optimizando carga de equipos, categorías y niveles educacionales</div>
        </div>
      )}

      {/* Error de carga */}
      {errorCarga && (
        <div style={{
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem 0',
          textAlign: 'center',
          color: '#c62828'
        }}>
          <div style={{ fontSize: '1.2em', marginBottom: '0.5rem' }}>❌ {errorCarga}</div>
          <button 
            onClick={cargarTodosDatos}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            🔄 Reintentar
          </button>
        </div>
      )}

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

      {/* Formulario unificado de creación de niveles educacionales, categorías y equipos */}
      <div className="create-team-section" style={{background:'white', borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.1)', padding:'2rem 1.5rem', marginBottom:32}}>
        {/* Apartado para crear nivel educacional */}
        <div style={{marginBottom:32, textAlign:'center'}}>
          <h2 className="section-title" style={{textAlign:'center'}}>
            <span className="section-icon">🏫</span>
            Crear Nuevo Nivel Educacional
          </h2>
          <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
            <input
              type="text"
              placeholder="Ej: Escuela, Colegio, etc."
              value={nuevoNivelEducacional}
              onChange={e => setNuevoNivelEducacional(e.target.value)}
              className="modern-input"
              style={{minWidth:220, maxWidth:340}}
            />
            <button
              onClick={async () => {
                if (!nuevoNivelEducacional.trim()) {
                  mostrarModalAlerta("⚠️ Datos incompletos", "Debes ingresar el nombre del nivel educacional", "error");
                  return;
                }
                
                // Verificar si ya existe
                const nivelExiste = nivelesEducacionales.some(nivel => 
                  nivel.nombre.toLowerCase() === nuevoNivelEducacional.trim().toLowerCase()
                );
                
                if (nivelExiste) {
                  mostrarModalAlerta("⚠️ Nivel duplicado", "Este nivel educacional ya existe", "error");
                  return;
                }

                await addDoc(collection(db, "nivelesEducacionales"), {
                  nombre: nuevoNivelEducacional.trim(),
                  disciplina: discipline,
                  fechaCreacion: new Date().toISOString()
                });
                setNuevoNivelEducacional("");
                cargarTodosDatos();
                mostrarModalAlerta("✅ Nivel creado", "Nivel educacional creado exitosamente", "success");
              }}
              className="modern-button"
              style={{minWidth:120}}
            >
              ➕ Crear
            </button>
            <button
              onClick={limpiarDuplicadosNivelesEducacionales}
              className="modern-button"
              style={{
                minWidth: 120,
                backgroundColor: '#e74c3c',
                color: 'white',
                marginLeft: '8px'
              }}
              title="Limpiar niveles educacionales duplicados"
            >
              🧹 Limpiar Duplicados
            </button>
          </div>
          
          {/* Lista de niveles educacionales existentes */}
          {nivelesEducacionales.length > 0 && (
            <div style={{marginTop:16}}>
              <h4 style={{color:'#666', fontSize:'0.9rem', marginBottom:8}}>Niveles Educacionales Existentes:</h4>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
                {nivelesEducacionales
                  .filter((nivel, index, self) => 
                    index === self.findIndex(n => n.nombre === nivel.nombre)
                  )
                  .map(nivel => (
                  <div key={nivel.id} style={{
                    background:'#f8f9fa', 
                    padding:'6px 12px', 
                    borderRadius:16, 
                    fontSize:'0.85rem',
                    border:'1px solid #e9ecef',
                    display:'flex',
                    alignItems:'center',
                    gap:8
                  }}>
                    <span>🏫 {nivel.nombre}</span>
                    
                    {nivelEducacionalEditando === nivel.id ? (
                      <div style={{display:'flex', gap:4, alignItems:'center'}}>
                        <input
                          type="text"
                          value={nuevoNombreNivelEducacional}
                          onChange={e => setNuevoNombreNivelEducacional(e.target.value)}
                          style={{fontSize:'0.85rem', padding:'2px 6px', width:80, border:'1px solid #ddd', borderRadius:4}}
                          autoFocus
                          onKeyPress={e => {
                            if (e.key === 'Enter') {
                              actualizarNivelEducacional(nivel.id, nuevoNombreNivelEducacional, nivel.nombre);
                            }
                          }}
                        />
                        <button 
                          onClick={() => actualizarNivelEducacional(nivel.id, nuevoNombreNivelEducacional, nivel.nombre)}
                          style={{fontSize:'0.7rem', padding:'2px 6px', background:'#28a745', color:'white', border:'none', borderRadius:3, cursor:'pointer'}}
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => {
                            setNivelEducacionalEditando(null);
                            setNuevoNombreNivelEducacional("");
                          }}
                          style={{fontSize:'0.7rem', padding:'2px 6px', background:'#6c757d', color:'white', border:'none', borderRadius:3, cursor:'pointer'}}
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <div style={{display:'flex', gap:4}}>
                        <button 
                          onClick={() => {
                            setNivelEducacionalEditando(nivel.id);
                            setNuevoNombreNivelEducacional(nivel.nombre);
                          }}
                          style={{fontSize:'0.7rem', background:'none', border:'none', cursor:'pointer', padding:2}}
                          title="Editar nivel"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => eliminarNivelEducacional(nivel.id, nivel.nombre)}
                          style={{fontSize:'0.7rem', background:'none', border:'none', cursor:'pointer', padding:2}}
                          title="Eliminar nivel"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
              value={filtroNivelEducacional}
              onChange={e => handleFiltroNivelEducacionalChange(e.target.value)}
              className="modern-input"
              style={{minWidth:140, maxWidth:160}}
            >
              <option value="">Todos los niveles</option>
              {nivelesEducacionales
                .filter((nivel, index, array) => 
                  array.findIndex(n => n.nombre === nivel.nombre) === index
                )
                .map(nivel => (
                  <option key={nivel.id} value={nivel.nombre}>{nivel.nombre}</option>
                ))}
            </select>
            <select
              value={filtroGenero}
              onChange={e => handleFiltroGeneroChange(e.target.value)}
              className="modern-input"
              style={{minWidth:140, maxWidth:160}}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
            <button
              onClick={async () => {
                if (!nuevaCategoria.trim() || !filtroNivelEducacional || !filtroGenero) {
                  mostrarModalAlerta("⚠️ Datos incompletos", "Debes ingresar el nombre de la categoría, seleccionar un nivel educacional y un género", "error");
                  return;
                }
                
                // Verificar si ya existe
                const categoriaExiste = categorias.some(cat => 
                  cat.nombre.toLowerCase() === nuevaCategoria.trim().toLowerCase() &&
                  cat.nivelEducacional === filtroNivelEducacional &&
                  cat.genero === filtroGenero
                );
                
                if (categoriaExiste) {
                  mostrarModalAlerta("⚠️ Categoría duplicada", "Esta categoría ya existe para este nivel educacional y género", "error");
                  return;
                }

                await addDoc(collection(db, "categorias"), { 
                  nombre: nuevaCategoria.trim(),
                  nivelEducacional: filtroNivelEducacional,
                  genero: filtroGenero,
                  disciplina: discipline,
                  fechaCreacion: new Date().toISOString()
                });
                setNuevaCategoria("");
                obtenerCategorias();
                mostrarModalAlerta("✅ Categoría creada", "Categoría creada exitosamente", "success");
              }}
              className="create-btn"
              style={{
                padding:'0 1.2em', 
                minWidth:120,
                opacity: (!nuevaCategoria.trim() || !filtroNivelEducacional || !filtroGenero) ? 0.5 : 1,
                cursor: (!nuevaCategoria.trim() || !filtroNivelEducacional || !filtroGenero) ? 'not-allowed' : 'pointer'
              }}
              disabled={!nuevaCategoria.trim() || !filtroNivelEducacional || !filtroGenero}
            >
              <span className="btn-icon">✨</span>
              <span>Crear Categoría</span>
            </button>
            {categorias.length > 0 && (
              <div style={{marginTop:16, display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', width:'100%'}}>
                {categorias
                  .filter(cat => 
                    (filtroGenero === "" || cat.genero === filtroGenero) &&
                    (filtroNivelEducacional === "" || cat.nivelEducacional === filtroNivelEducacional)
                  )
                  .map(cat => (
                  <div key={cat.id} style={{background:'#e7e3fa', borderRadius:8, padding:'4px 8px', fontSize:'0.85em', display:'inline-flex', alignItems:'center', gap:6}}>
                    {categoriaEditando === cat.id ? (
                      // Modo edición
                      <div style={{display:'flex', alignItems:'center', gap:4}}>
                        <input
                          type="text"
                          value={nuevoNombreCategoria}
                          onChange={e => setNuevoNombreCategoria(e.target.value)}
                          style={{
                            fontSize:'0.85em',
                            padding:'2px 6px',
                            border:'1px solid #ccc',
                            borderRadius:4,
                            minWidth:'80px'
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
                        <span>{cat.nombre} ({cat.nivelEducacional} - {cat.genero})</span>
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
                    nivelEducacional: "", // Limpiar nivel al cambiar género
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
                <span className="label-icon">🏫</span>
                Nivel Educacional
              </label>
              <select
                className="modern-input"
                value={nuevoEquipo.nivelEducacional}
                onChange={e => {
                  setNuevoEquipo({ 
                    ...nuevoEquipo, 
                    nivelEducacional: e.target.value,
                    categoria: "", // Limpiar categoría al cambiar nivel
                    grupo: "" // Limpiar grupo al cambiar nivel
                  });
                }}
              >
                <option value="">
                  {!nuevoEquipo.genero ? "Primero selecciona un género" : "Selecciona un nivel educacional"}
                </option>
                {nuevoEquipo.genero && (
                  <>
                    <option value="Escuela">Escuela</option>
                    <option value="Colegio">Colegio</option>
                  </>
                )}
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
                disabled={!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional}
                style={{
                  backgroundColor: (!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional) ? '#f5f5f5' : '',
                  color: (!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional) ? '#999' : '',
                  cursor: (!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional) ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="">
                  {!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional 
                    ? "Primero selecciona género y nivel educacional" 
                    : "Selecciona una categoría"}
                </option>
                {categorias
                  .filter(cat => 
                    cat.genero === nuevoEquipo.genero && 
                    cat.nivelEducacional === nuevoEquipo.nivelEducacional
                  )
                  .map(cat => (
                    <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                  ))}
              </select>
              {(!nuevoEquipo.genero || !nuevoEquipo.nivelEducacional) && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona género y nivel educacional
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
                  disabled={!nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero}
                  style={{
                    backgroundColor: (!nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero) ? '#f5f5f5' : '',
                    color: (!nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero) ? '#999' : '',
                    cursor: (!nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero) ? 'not-allowed' : 'text'
                  }}
                />
                <datalist id="grupos-list">
                  {grupos
                    .filter(g => 
                      g.categoria === nuevoEquipo.categoria && 
                      g.nivelEducacional === nuevoEquipo.nivelEducacional &&
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
                        eliminarGrupo(nuevoEquipo.grupo, nuevoEquipo.categoria, nuevoEquipo.nivelEducacional, nuevoEquipo.genero);
                        setNuevoEquipo({ ...nuevoEquipo, grupo: "" });
                      }
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
              {(!nuevoEquipo.categoria || !nuevoEquipo.nivelEducacional || !nuevoEquipo.genero) && (
                <small style={{color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block'}}>
                  Primero selecciona género, nivel educacional y categoría
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
                const pasaNivel = filtroNivelEducacional === "" || equipo.nivelEducacional === filtroNivelEducacional;
                const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
                return pasaGenero && pasaNivel && pasaCategoria;
              }).length}
            </span>
            <span>
              {(() => {
                const filtros = [];
                if (filtroGenero !== "") filtros.push(filtroGenero);
                if (filtroNivelEducacional !== "") filtros.push(filtroNivelEducacional);
                if (filtroCategoria !== "") filtros.push(filtroCategoria);
                
                if (filtros.length === 0) return "equipos totales";
                return `equipos ${filtros.join(" - ")}`;
              })()}
            </span>
          </div>
        </div>

        {/* Filtros por género, nivel educacional y categoría */}
        <div style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🚻</span>
              Filtrar por género:
            </label>
            <select
              value={filtroGenero}
              onChange={e => {
                handleFiltroGeneroChange(e.target.value);
                // Limpiar filtros dependientes si cambia el género
                setFiltroNivelEducacional("");
                setFiltroCategoria("");
                localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
                localStorage.removeItem('olimpiadas_filtro_categoria');
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
              <span style={{marginRight: '0.5rem'}}>🏫</span>
              Filtrar por nivel:
            </label>
            <select
              value={filtroNivelEducacional}
              onChange={e => {
                handleFiltroNivelEducacionalChange(e.target.value);
                // Limpiar filtro de categoría si cambia el nivel
                setFiltroCategoria("");
                localStorage.removeItem('olimpiadas_filtro_categoria');
              }}
              className="modern-input"
              style={{minWidth: '140px', maxWidth: '180px'}}
            >
              <option value="">Todos los niveles</option>
              {nivelesEducacionales
                .filter(nivel => filtroGenero === "" || 
                  categorias.some(cat => cat.nivelEducacional === nivel.nombre && cat.genero === filtroGenero)
                )
                .map(nivel => (
                  <option key={nivel.id} value={nivel.nombre}>{nivel.nombre}</option>
                ))}
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🏷️</span>
              Filtrar por categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => handleFiltroCategoriaChange(e.target.value)}
              className="modern-input"
              style={{
                minWidth: '200px', 
                maxWidth: '300px',
                backgroundColor: (!filtroGenero || !filtroNivelEducacional) ? '#f5f5f5' : '',
                color: (!filtroGenero || !filtroNivelEducacional) ? '#999' : '',
                cursor: (!filtroGenero || !filtroNivelEducacional) ? 'not-allowed' : 'pointer'
              }}
              disabled={!filtroGenero || !filtroNivelEducacional}
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
        </div>

        <div className="table-container">
          <div className="modern-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">�️</span>
                      Género
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">📚</span>
                      Nivel Educacional
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">⚽</span>
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
                    const pasaNivelEducacional = filtroNivelEducacional === "" || equipo.nivelEducacional === filtroNivelEducacional;
                    const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
                    return pasaGenero && pasaNivelEducacional && pasaCategoria;
                  })
                  .sort((a, b) => {
                    // Primero ordenar por género
                    if ((a.genero || "") < (b.genero || "")) return -1;
                    if ((a.genero || "") > (b.genero || "")) return 1;
                    // Luego por nivel educacional
                    if ((a.nivelEducacional || "") < (b.nivelEducacional || "")) return -1;
                    if ((a.nivelEducacional || "") > (b.nivelEducacional || "")) return 1;
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
                          value={equipo.nivelEducacional || ""}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "nivelEducacional", e.target.value)
                          }
                          className="table-select"
                        >
                          <option value="">Sin nivel educacional</option>
                          {nivelesEducacionales
                            .filter(nivel => {
                              // Mostrar nivel si no tiene género especificado O si coincide con el género del equipo
                              return !nivel.genero || !equipo.genero || nivel.genero === equipo.genero;
                            })
                            .map((nivel) => (
                              <option key={nivel.id} value={nivel.nombre}>
                                {nivel.nombre}
                              </option>
                            ))}
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
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            list={`grupos-list-${equipo.id}`}
                            defaultValue={equipo.grupo || ""}
                            onBlur={(e) => {
                              if (e.target.value !== equipo.grupo) {
                                actualizarEquipo(equipo.id, "grupo", e.target.value);
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur(); // Esto activará el onBlur
                              }
                            }}
                            className="table-input"
                            placeholder="Escribe o selecciona grupo"
                            style={{ paddingRight: equipo.grupo ? '60px' : '30px' }}
                          />
                          <datalist id={`grupos-list-${equipo.id}`}>
                            <option value="">Sin grupo</option>
                            {grupos
                              .filter(g => 
                                g.categoria === equipo.categoria && 
                                g.genero === equipo.genero
                              )
                              .map((g) => (
                                <option key={g.id} value={g.nombre}>
                                  {g.nombre}
                                </option>
                              ))}
                          </datalist>
                          
                          {/* Botón para confirmar creación de grupo nuevo */}
                          {equipo.grupo && !grupos.find(g => 
                            g.nombre === equipo.grupo && 
                            g.categoria === equipo.categoria && 
                            g.genero === equipo.genero
                          ) && (
                            <button
                              onClick={() => actualizarEquipo(equipo.id, "grupo", equipo.grupo)}
                              style={{
                                position: 'absolute',
                                right: equipo.grupo ? '30px' : '8px',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Crear grupo"
                            >
                              ✓
                            </button>
                          )}
                          
                          {/* Botón para eliminar grupo existente */}
                          {equipo.grupo && grupos.find(g => 
                            g.nombre === equipo.grupo && 
                            g.categoria === equipo.categoria && 
                            g.genero === equipo.genero
                          ) && (
                            <button
                              onClick={() => {
                                mostrarModalConfirmacion(
                                  "⚠️ Eliminar Grupo",
                                  `¿Estás seguro de eliminar el grupo "${equipo.grupo}"?\n\nEsto afectará a todos los equipos asignados a este grupo y los dejará sin grupo.`,
                                  (confirmado) => {
                                    if (confirmado) {
                                      eliminarGrupo(equipo.grupo, equipo.categoria, equipo.genero);
                                    }
                                  }
                                );
                              }}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Eliminar grupo"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => eliminarEquipoCompleto(equipo)}
                          className="delete-team-btn"
                          title="Eliminar equipo completo (con todos sus jugadores)"
                          style={{backgroundColor: '#dc3545', color: 'white'}}
                        >
                          <span className="btn-icon">🗑️</span>
                          <span>Eliminar Todo</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {equipos.filter(equipo => {
            const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
            const pasaNivelEducacional = filtroNivelEducacional === "" || equipo.nivelEducacional === filtroNivelEducacional;
            const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
            return pasaGenero && pasaNivelEducacional && pasaCategoria;
          }).length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>
                {(() => {
                  if (filtroGenero === "" && filtroNivelEducacional === "" && filtroCategoria === "") return "No hay equipos registrados";
                  let mensaje = "No hay equipos";
                  if (filtroGenero !== "") mensaje += ` ${filtroGenero}`;
                  if (filtroNivelEducacional !== "") mensaje += ` de ${filtroNivelEducacional}`;
                  if (filtroCategoria !== "") mensaje += ` en la categoría "${filtroCategoria}"`;
                  return mensaje + " registrados";
                })()}
              </h3>
              <p>
                {(() => {
                  if (filtroGenero === "" && filtroNivelEducacional === "" && filtroCategoria === "") return "Crea el primer equipo para comenzar el torneo";
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
          
          <details style={{marginTop:'1rem'}}>
            <summary style={{cursor:'pointer', color:'#6c757d', fontWeight:'bold'}}>
              📋 Ver formato requerido del Excel
            </summary>
            <div style={{marginTop:'0.75rem', fontSize:'0.9em', color:'#6c757d'}}>
              <div style={{backgroundColor:'#ffffff', padding:'1rem', borderRadius:'5px', marginTop:'0.5rem', border:'1px solid #e9ecef'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.85em'}}>
                  <thead>
                    <tr style={{backgroundColor:'#e9ecef'}}>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>nombre</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>curso</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>paralelo</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>nivel educacional</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>categoria</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>grupo</th>
                      <th style={{border:'1px solid #ccc', padding:'8px', textAlign:'left'}}>genero</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>PÉREZ JUAN CARLOS</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>2do BGU</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>A</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>Bachillerato</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>Básica Superior</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>Grupo A</td>
                      <td style={{border:'1px solid #ccc', padding:'8px'}}>Hombre</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:'0.5rem', fontSize:'0.8em', color:'#28a745'}}>
                ✨ <strong>El sistema crea automáticamente</strong> niveles educacionales, categorías, grupos, cursos, paralelos y equipos que no existan.
              </div>
              <div style={{marginTop:'0.3rem', fontSize:'0.8em', color:'#6c757d'}}>
                📝 <strong>Nota:</strong> El campo "grupo" es opcional. Si no se especifica, el equipo se creará sin grupo asignado.
              </div>
            </div>
          </details>
        </div>

        {/* Pantalla de progreso */}
        {mostrarProgreso && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: '4px solid #e9ecef',
                  borderTop: '4px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <h3 style={{color: '#007bff', margin: 0}}>⚡ Procesando datos...</h3>
              </div>
              
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9em'
              }}>
                {progresoMensajes.length === 0 ? (
                  <div style={{color: '#6c757d', textAlign: 'center'}}>Iniciando...</div>
                ) : (
                  progresoMensajes.map((mensaje, index) => (
                    <div 
                      key={index} 
                      style={{
                        padding: '0.25rem 0',
                        color: '#495057',
                        borderBottom: index < progresoMensajes.length - 1 ? '1px solid #e9ecef' : 'none'
                      }}
                    >
                      {mensaje}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botones de eliminación masiva */}
        <div style={{
          backgroundColor: '#ffe6e6', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          border: '1px solid #ffcccc',
          marginBottom: '2rem'
        }}>
          <h3 style={{margin: '0 0 1rem 0', color: '#dc3545', fontSize: '1.1rem'}}>
            🗑️ Eliminación Masiva de Datos
          </h3>
          <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
            <button
              onClick={eliminarTodosDatos}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}
            >
              🚨 Eliminar TODO
            </button>
            <button
              onClick={() => {
                console.log("=== DIAGNÓSTICO DE EQUIPOS ===");
                equipos.forEach((equipo, index) => {
                  console.log(`Equipo ${index + 1}:`, {
                    id: equipo.id,
                    curso: equipo.curso,
                    paralelo: equipo.paralelo,
                    categoria: equipo.categoria,
                    genero: equipo.genero,
                    nivelEducacional: equipo.nivelEducacional,
                    nivelEducacionalTipo: typeof equipo.nivelEducacional,
                    tieneNivelEducacional: !!equipo.nivelEducacional,
                    objetoCompleto: equipo
                  });
                });
                console.log("=== NIVELES EDUCACIONALES DISPONIBLES ===");
                console.log(nivelesEducacionales);
                alert("Revisa la consola del navegador (F12) para ver el diagnóstico completo");
              }}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                marginLeft: '10px'
              }}
            >
              � Diagnosticar Datos
            </button>
            {categorias.map(cat => (
              <button
                key={`${cat.nombre}-${cat.genero}`}
                onClick={() => eliminarCategoriaCompleta(cat.nombre, cat.genero)}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                🗑️ {cat.nombre} ({cat.genero})
              </button>
            ))}
          </div>
          <div style={{fontSize: '0.8em', color: '#6c757d', marginTop: '0.75rem'}}>
            ⚠️ Todas las eliminaciones requieren tu contraseña de administrador y confirmación doble.
            <br />
            � <strong>Se verificará tu identidad</strong> con tu contraseña de Firebase antes de proceder.
          </div>
        </div>

        {/* Nota adicional sobre diagnóstico */}
        <div style={{fontSize: '0.8em', color: '#28a745', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#e8f5e9', borderRadius: '4px'}}>
          � <strong>¿Los niveles educacionales no se muestran?</strong><br/>
          Usa el botón "Diagnosticar Datos" para revisar qué información tienen los equipos en la base de datos.
        </div>



        {/* Seleccionar equipo para gestionar jugadores */}
        <div style={{marginBottom:'2rem'}}>
          <h3 style={{margin:'0 0 1rem 0', color:'#495057', fontSize:'1.1rem'}}>
            🏆 Seleccionar Equipo para Gestionar
          </h3>

          {/* Filtros para el selector de equipos */}
          <div style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <label style={{fontWeight: '500', color: '#666'}}>
                <span style={{marginRight: '0.5rem'}}>🚻</span>
                Filtrar por género:
              </label>
              <select
                value={filtroGeneroSelector}
                onChange={e => {
                  setFiltroGeneroSelector(e.target.value);
                  // Limpiar filtros dependientes si cambia el género
                  setFiltroNivelEducacionalSelector("");
                  setFiltroCategoriaSelector("");
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
                <span style={{marginRight: '0.5rem'}}>🏫</span>
                Filtrar por nivel:
              </label>
              <select
                value={filtroNivelEducacionalSelector}
                onChange={e => {
                  setFiltroNivelEducacionalSelector(e.target.value);
                  // Limpiar filtro de categoría si cambia el nivel
                  setFiltroCategoriaSelector("");
                }}
                className="modern-input"
                style={{minWidth: '140px', maxWidth: '180px'}}
              >
                <option value="">Todos los niveles</option>
                {nivelesEducacionales
                  .filter(nivel => filtroGeneroSelector === "" || 
                    categorias.some(cat => cat.nivelEducacional === nivel.nombre && cat.genero === filtroGeneroSelector)
                  )
                  .filter((nivel, index, array) => 
                    array.findIndex(n => n.nombre === nivel.nombre) === index
                  )
                  .map(nivel => (
                    <option key={nivel.id} value={nivel.nombre}>{nivel.nombre}</option>
                  ))}
              </select>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <label style={{fontWeight: '500', color: '#666'}}>
                <span style={{marginRight: '0.5rem'}}>🏷️</span>
                Filtrar por categoría:
              </label>
              <select
                value={filtroCategoriaSelector}
                onChange={e => handleFiltroCategoriaChangeSelector(e.target.value)}
                className="modern-input"
                style={{
                  minWidth: '200px', 
                  maxWidth: '300px',
                  backgroundColor: (!filtroGeneroSelector || !filtroNivelEducacionalSelector) ? '#f5f5f5' : '',
                  color: (!filtroGeneroSelector || !filtroNivelEducacionalSelector) ? '#999' : '',
                  cursor: (!filtroGeneroSelector || !filtroNivelEducacionalSelector) ? 'not-allowed' : 'pointer'
                }}
                disabled={!filtroGeneroSelector || !filtroNivelEducacionalSelector}
              >
                <option value="">Todas las categorías</option>
                {categorias
                  .filter(categoria => {
                    if (filtroGeneroSelector && categoria.genero !== filtroGeneroSelector) return false;
                    if (filtroNivelEducacionalSelector && categoria.nivelEducacional !== filtroNivelEducacionalSelector) return false;
                    return true;
                  })
                  .map(categoria => (
                    <option key={categoria.id} value={categoria.nombre}>
                      {categoria.nombre}
                    </option>
                  ))}
              </select>
            </div>

            {/* Botón para limpiar filtros del selector */}
            {(filtroGeneroSelector || filtroNivelEducacionalSelector || filtroCategoriaSelector) && (
              <button
                onClick={() => {
                  setFiltroGeneroSelector("");
                  setFiltroNivelEducacionalSelector("");
                  setFiltroCategoriaSelector("");
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                title="Limpiar todos los filtros del selector"
              >
                🗑️ Limpiar filtros
              </button>
            )}
          </div>
          
          {/* Contador de equipos filtrados para el selector */}
          <div style={{marginBottom: '1rem'}}>
            <span style={{
              fontSize: '0.9rem',
              color: '#666',
              background: '#f8f9fa',
              padding: '0.4rem 0.8rem',
              borderRadius: '12px',
              border: '1px solid #dee2e6'
            }}>
              {(() => {
                const equiposFiltradosSelector = equipos.filter(equipo => {
                  const pasaGenero = filtroGeneroSelector === "" || equipo.genero === filtroGeneroSelector;
                  const pasaNivelEducacional = filtroNivelEducacionalSelector === "" || equipo.nivelEducacional === filtroNivelEducacionalSelector;
                  const pasaCategoria = filtroCategoriaSelector === "" || equipo.categoria === filtroCategoriaSelector;
                  return pasaGenero && pasaNivelEducacional && pasaCategoria;
                });
                return `${equiposFiltradosSelector.length} equipos disponibles`;
              })()}
            </span>
          </div>

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
            {equipos
              .filter(equipo => {
                const pasaGenero = filtroGeneroSelector === "" || equipo.genero === filtroGeneroSelector;
                const pasaNivelEducacional = filtroNivelEducacionalSelector === "" || equipo.nivelEducacional === filtroNivelEducacionalSelector;
                const pasaCategoria = filtroCategoriaSelector === "" || equipo.categoria === filtroCategoriaSelector;
                return pasaGenero && pasaNivelEducacional && pasaCategoria;
              })
              .map(equipo => (
                <option key={equipo.id} value={`${equipo.curso}-${equipo.paralelo}-${equipo.categoria}-${equipo.genero || ''}`}>
                  {equipo.genero ? `${equipo.genero} - ` : ''}{equipo.curso} {equipo.paralelo} - {equipo.categoria} ({equipo.grupo || 'Sin grupo'})
                </option>
              ))}
          </select>

          {/* Mensaje cuando no hay equipos que coincidan con los filtros del selector */}
          {equipos.filter(equipo => {
            const pasaGenero = filtroGeneroSelector === "" || equipo.genero === filtroGeneroSelector;
            const pasaNivelEducacional = filtroNivelEducacionalSelector === "" || equipo.nivelEducacional === filtroNivelEducacionalSelector;
            const pasaCategoria = filtroCategoriaSelector === "" || equipo.categoria === filtroCategoriaSelector;
            return pasaGenero && pasaNivelEducacional && pasaCategoria;
          }).length === 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              color: '#856404'
            }}>
              <strong>📝 Sin equipos coincidentes</strong><br/>
              No hay equipos que coincidan con los filtros del selector. Modifica los filtros del selector para ver más equipos.
            </div>
          )}
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

      {/* Modal de contraseña personalizado */}
      {modalPassword.mostrar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '3px solid #007bff'
          }}>
            <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
              <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>🔐</div>
              <h3 style={{color: '#007bff', margin: '0 0 0.5rem 0'}}>Verificación de Identidad</h3>
              <p style={{color: '#6c757d', margin: 0, fontSize: '0.9rem'}}>
                Usuario: <strong>{localStorage.getItem('userEmail')}</strong>
              </p>
            </div>
            
            <div style={{marginBottom: '1.5rem'}}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#495057'}}>
                Confirma tu contraseña:
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    modalPassword.callback(inputPassword);
                    cerrarModalPassword();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                placeholder="Ingresa tu contraseña"
                autoFocus
              />
            </div>
            
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button
                onClick={cerrarModalPassword}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  modalPassword.callback(inputPassword);
                  cerrarModalPassword();
                }}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Verificar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación personalizado */}
      {modalConfirmacion.mostrar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '3px solid #ffc107'
          }}>
            <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
              <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>⚠️</div>
              <h3 style={{color: '#dc3545', margin: '0 0 1rem 0'}}>{modalConfirmacion.titulo}</h3>
              <p style={{color: '#495057', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line'}}>
                {modalConfirmacion.mensaje}
              </p>
            </div>
            
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
              <button
                onClick={() => {
                  modalConfirmacion.callback(false);
                  cerrarModalConfirmacion();
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                No, Cancelar
              </button>
              <button
                onClick={() => {
                  modalConfirmacion.callback(true);
                  cerrarModalConfirmacion();
                }}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de alerta personalizado */}
      {modalAlerta.mostrar && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 10001,
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          border: `3px solid ${modalAlerta.tipo === 'success' ? '#28a745' : modalAlerta.tipo === 'error' ? '#dc3545' : '#007bff'}`,
          animation: 'slideInFromRight 0.3s ease-out'
        }}>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: '1rem'}}>
            <div style={{fontSize: '2rem'}}>
              {modalAlerta.tipo === 'success' ? '✅' : modalAlerta.tipo === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div style={{flex: 1}}>
              <h4 style={{
                margin: '0 0 0.5rem 0', 
                color: modalAlerta.tipo === 'success' ? '#28a745' : modalAlerta.tipo === 'error' ? '#dc3545' : '#007bff'
              }}>
                {modalAlerta.titulo}
              </h4>
              <p style={{margin: 0, color: '#495057', lineHeight: '1.4'}}>
                {modalAlerta.mensaje}
              </p>
            </div>
            <button
              onClick={() => setModalAlerta({ mostrar: false, titulo: '', mensaje: '', tipo: 'info' })}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: '#6c757d',
                padding: 0,
                width: '24px',
                height: '24px'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal de Texto para confirmación personalizada */}
      {modalTexto.mostrar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            animation: 'slideInFromRight 0.3s ease-out'
          }}>
            <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
              <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔐</div>
              <h3 style={{margin: '0 0 0.5rem 0', color: '#dc3545'}}>{modalTexto.titulo}</h3>
              <p style={{margin: 0, color: '#495057'}}>{modalTexto.mensaje}</p>
            </div>
            
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Escribe el texto requerido..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #ced4da',
                borderRadius: '6px',
                fontSize: '1rem',
                marginBottom: '1.5rem',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  modalTexto.callback(inputTexto);
                  cerrarModalTexto();
                }
              }}
              autoFocus
            />
            
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button
                onClick={cerrarModalTexto}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  modalTexto.callback(inputTexto);
                  cerrarModalTexto();
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
