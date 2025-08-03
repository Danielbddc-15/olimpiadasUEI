import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import "../styles/AdminUsers.css";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    email: "",
    password: "",
    role: "profesor"
  });
  const [filtroRol, setFiltroRol] = useState("");
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({});
  const [mostrarPasswordFormulario, setMostrarPasswordFormulario] = useState(false);

  // Obtener usuarios desde Firestore
  const obtenerUsuarios = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsuarios(data);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
    }
  };

  useEffect(() => {
    obtenerUsuarios();
  }, []);

  // Crear nuevo usuario
  const crearUsuario = async () => {
    if (!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password) {
      alert("Por favor, completa todos los campos");
      return;
    }

    // Validar email único
    const emailExiste = usuarios.some(u => u.email === nuevoUsuario.email);
    if (emailExiste) {
      alert("Este email ya está registrado");
      return;
    }

    try {
      // 1. Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        nuevoUsuario.email, 
        nuevoUsuario.password
      );
      
      const uid = userCredential.user.uid;

      // 2. Crear documento en Firestore usando el UID como ID del documento
      await setDoc(doc(db, "users", uid), {
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        role: nuevoUsuario.role,
        fechaCreacion: new Date().toISOString()
        // No guardamos la contraseña en Firestore por seguridad
      });
      
      setNuevoUsuario({ nombre: "", email: "", password: "", role: "profesor" });
      obtenerUsuarios();
      alert("Usuario creado exitosamente en Authentication y Firestore");
    } catch (error) {
      console.error("Error al crear usuario:", error);
      
      // Manejar errores específicos de Firebase Auth
      let errorMessage = "Error al crear usuario";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este email ya está registrado en Authentication";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña debe tener al menos 6 caracteres";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "El formato del email no es válido";
      }
      
      alert(errorMessage);
    }
  };

  // Actualizar usuario
  const actualizarUsuario = async (id, campo, valor) => {
    try {
      const ref = doc(db, "users", id);
      await updateDoc(ref, { [campo]: valor });
      obtenerUsuarios();
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      alert("Error al actualizar usuario");
    }
  };

  // Eliminar usuario
  const eliminarUsuario = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${nombre}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", id));
      obtenerUsuarios();
      alert("Usuario eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("Error al eliminar usuario");
    }
  };

  // Editar usuario completo
  const iniciarEdicion = (usuario) => {
    setUsuarioEditando(usuario.id);
    setDatosEdicion({
      nombre: usuario.nombre,
      email: usuario.email,
      role: usuario.role
    });
  };

  const guardarEdicion = async () => {
    try {
      const ref = doc(db, "users", usuarioEditando);
      await updateDoc(ref, datosEdicion);
      setUsuarioEditando(null);
      setDatosEdicion({});
      obtenerUsuarios();
      alert("Usuario actualizado exitosamente");
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      alert("Error al actualizar usuario");
    }
  };

  const cancelarEdicion = () => {
    setUsuarioEditando(null);
    setDatosEdicion({});
  };

  // Navegación
  const goToPanel = () => {
    navigate('/admin');
  };

  // Filtrar usuarios
  const usuariosFiltrados = usuarios.filter(usuario => 
    filtroRol === "" || usuario.role === filtroRol
  );

  return (
    <div className="admin-users-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-icon">👥</div>
        <h1 className="admin-title">Gestión de Usuarios</h1>
        <p className="admin-subtitle">
          Administra usuarios con roles de Administrador y Profesor
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
      </div>

      {/* Formulario de creación de usuario */}
      <div className="create-user-section" style={{
        background: 'white', 
        borderRadius: 20, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)', 
        padding: '2rem 1.5rem', 
        marginBottom: 32
      }}>
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Crear Nuevo Usuario
        </h2>

        <div className="create-user-form">
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">👤</span>
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez"
                value={nuevoUsuario.nombre}
                onChange={(e) =>
                  setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📧</span>
                Email
              </label>
              <input
                type="email"
                placeholder="ejemplo@email.com"
                value={nuevoUsuario.email}
                onChange={(e) =>
                  setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🔒</span>
                Contraseña
              </label>
              <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                <input
                  type={mostrarPasswordFormulario ? "text" : "password"}
                  placeholder="Contraseña segura"
                  value={nuevoUsuario.password}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })
                  }
                  className="modern-input"
                  style={{paddingRight: '3rem'}}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPasswordFormulario(!mostrarPasswordFormulario)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    color: '#666',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={mostrarPasswordFormulario ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {mostrarPasswordFormulario ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏷️</span>
                Rol
              </label>
              <select
                className="modern-input"
                value={nuevoUsuario.role}
                onChange={e => setNuevoUsuario({ ...nuevoUsuario, role: e.target.value })}
              >
                <option value="profesor">Profesor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <button onClick={crearUsuario} className="create-btn">
              <span className="btn-icon">✨</span>
              <span>Crear Usuario</span>
            </button>
          </div>
          
          <div style={{
            marginTop: '1rem', 
            padding: '0.75rem 1rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px', 
            border: '1px solid #bbdefb',
            fontSize: '0.9em',
            color: '#1565c0'
          }}>
            <strong>ℹ️ Información:</strong> Al crear un usuario se registrará tanto en Firebase Authentication como en la base de datos. 
            El usuario podrá iniciar sesión con el email y contraseña proporcionados.
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="users-table-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📋</span>
            Usuarios Registrados
          </h2>
          <div className="users-count">
            <span className="count-badge">
              {filtroRol === "" 
                ? usuarios.length 
                : usuarios.filter(usuario => usuario.role === filtroRol).length
              }
            </span>
            <span>
              {filtroRol === "" 
                ? "usuarios totales" 
                : `${filtroRol}${filtroRol === "profesor" ? "es" : "es"}`
              }
            </span>
          </div>
        </div>

        {/* Filtro por rol */}
        <div style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <label style={{fontWeight: '500', color: '#666'}}>
            <span style={{marginRight: '0.5rem'}}>🏷️</span>
            Filtrar por rol:
          </label>
          <select
            value={filtroRol}
            onChange={e => setFiltroRol(e.target.value)}
            className="modern-input"
            style={{minWidth: '200px', maxWidth: '300px'}}
          >
            <option value="">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="profesor">Profesores</option>
          </select>
        </div>

        <div className="table-container">
          <div className="modern-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">👤</span>
                      Nombre
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">📧</span>
                      Email
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">🔒</span>
                      Contraseña
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">🏷️</span>
                      Rol
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
                {usuariosFiltrados
                  .sort((a, b) => {
                    // Primero administradores, luego profesores
                    if (a.role === "admin" && b.role === "profesor") return -1;
                    if (a.role === "profesor" && b.role === "admin") return 1;
                    // Luego por nombre
                    return (a.nombre || "").localeCompare(b.nombre || "");
                  })
                  .map((usuario) => (
                    <tr key={usuario.id} className="table-row">
                      <td className="table-cell">
                        {usuarioEditando === usuario.id ? (
                          <input
                            value={datosEdicion.nombre}
                            onChange={(e) =>
                              setDatosEdicion({ ...datosEdicion, nombre: e.target.value })
                            }
                            className="table-input"
                          />
                        ) : (
                          <span>{usuario.nombre}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {usuarioEditando === usuario.id ? (
                          <input
                            type="email"
                            value={datosEdicion.email}
                            onChange={(e) =>
                              setDatosEdicion({ ...datosEdicion, email: e.target.value })
                            }
                            className="table-input"
                          />
                        ) : (
                          <span>{usuario.email}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{color: '#666', fontStyle: 'italic'}}>
                            No almacenada por seguridad
                          </span>
                          <button
                            disabled
                            style={{
                              background: '#e0e0e0',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.8em',
                              cursor: 'not-allowed',
                              color: '#999'
                            }}
                            title="Las contraseñas no se almacenan en la base de datos por seguridad"
                          >
                            🔒
                          </button>
                        </div>
                      </td>
                      <td className="table-cell">
                        {usuarioEditando === usuario.id ? (
                          <select
                            value={datosEdicion.role}
                            onChange={(e) =>
                              setDatosEdicion({ ...datosEdicion, role: e.target.value })
                            }
                            className="table-select"
                          >
                            <option value="profesor">Profesor</option>
                            <option value="admin">Administrador</option>
                          </select>
                        ) : (
                          <span className={`role-badge ${usuario.role}`}>
                            {usuario.role === "admin" ? "🔑 Administrador" : "👨‍🏫 Profesor"}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div style={{display: 'flex', gap: '8px'}}>
                          {usuarioEditando === usuario.id ? (
                            <>
                              <button
                                onClick={guardarEdicion}
                                className="action-btn save-btn"
                                title="Guardar cambios"
                              >
                                ✅
                              </button>
                              <button
                                onClick={cancelarEdicion}
                                className="action-btn cancel-btn"
                                title="Cancelar"
                              >
                                ❌
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => iniciarEdicion(usuario)}
                                className="action-btn edit-btn"
                                title="Editar usuario"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => eliminarUsuario(usuario.id, usuario.nombre)}
                                className="action-btn delete-btn"
                                title="Eliminar usuario"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {usuariosFiltrados.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>
                {filtroRol === "" 
                  ? "No hay usuarios registrados" 
                  : `No hay ${filtroRol}${filtroRol === "profesor" ? "es" : "es"} registrados`
                }
              </h3>
              <p>
                {filtroRol === "" 
                  ? "Crea el primer usuario para comenzar" 
                  : "Selecciona otro filtro o crea un nuevo usuario"
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
