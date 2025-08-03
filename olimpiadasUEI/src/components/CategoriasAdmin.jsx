import React, { useEffect, useState } from "react";
import {
  crearCategoria,
  crearGrupo,
  crearEquipo,
  obtenerCategorias,
  obtenerGrupos,
  obtenerEquipos,
} from "../utils/firestoreCategories";
import { generarPartidosGrupo, generarSemifinales } from "../utils/GenerateGroupMatches";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";

function CategoriasAdmin() {
  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [grupoSeleccionado, setGrupoSeleccionado] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [partidosGenerados, setPartidosGenerados] = useState([]);
  const [generando, setGenerando] = useState(false);
  // Semifinales
  const [modoSemifinal, setModoSemifinal] = useState("cruzado");
  const [clasificadosA, setClasificadosA] = useState([]);
  const [clasificadosB, setClasificadosB] = useState([]);
  const [semifinales, setSemifinales] = useState([]);
  // Simulación: permite ingresar manualmente los clasificados de cada grupo para demo
  function handleChangeClasificadoA(idx, value) {
    const arr = [...clasificadosA];
    arr[idx] = value;
    setClasificadosA(arr);
  }
  function handleChangeClasificadoB(idx, value) {
    const arr = [...clasificadosB];
    arr[idx] = value;
    setClasificadosB(arr);
  }
  async function handleGenerarSemifinales() {
    if (clasificadosA.length < 2 || clasificadosB.length < 2 || !categoriaSeleccionada) return;
    const cruces = generarSemifinales(clasificadosA, clasificadosB, modoSemifinal);
    setSemifinales(cruces);
    // Guardar en Firestore (en la categoría, colección "semifinales")
    try {
      for (const cruce of cruces) {
        await addDoc(
          collection(db, `categorias/${categoriaSeleccionada}/semifinales`),
          {
            equipo1: cruce.equipo1,
            equipo2: cruce.equipo2,
            modo: modoSemifinal,
            timestamp: Date.now(),
          }
        );
      }
    } catch (e) {
      alert("Error guardando semifinales en Firestore: " + e.message);
    }
  }
  const [nuevoEquipo, setNuevoEquipo] = useState("");

  // Cargar categorías al iniciar
  useEffect(() => {
    cargarCategorias();
  }, []);

  async function cargarCategorias() {
    const cats = await obtenerCategorias();
    setCategorias(cats);
  }

  async function handleCrearCategoria(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    await crearCategoria(nuevaCategoria.trim());
    setNuevaCategoria("");
    cargarCategorias();
  }

  async function handleSeleccionarCategoria(id) {
    setCategoriaSeleccionada(id);
    setGrupoSeleccionado("");
    setEquipos([]);
    const grps = await obtenerGrupos(id);
    setGrupos(grps);
  }

  async function handleCrearGrupo(e) {
    e.preventDefault();
    if (!nuevoGrupo.trim() || !categoriaSeleccionada) return;
    await crearGrupo(categoriaSeleccionada, nuevoGrupo.trim());
    setNuevoGrupo("");
    handleSeleccionarCategoria(categoriaSeleccionada);
  }

  async function handleSeleccionarGrupo(id) {
    setGrupoSeleccionado(id);
    setPartidosGenerados([]);
    const eqs = await obtenerEquipos(categoriaSeleccionada, id);
    setEquipos(eqs);
  }
  async function handleGenerarPartidos() {
    if (!categoriaSeleccionada || !grupoSeleccionado || equipos.length < 2) return;
    setGenerando(true);
    try {
      const partidos = await generarPartidosGrupo(categoriaSeleccionada, grupoSeleccionado, equipos);
      setPartidosGenerados(partidos);
    } catch (e) {
      alert("Error generando partidos: " + e.message);
    }
    setGenerando(false);
  }

  async function handleCrearEquipo(e) {
    e.preventDefault();
    if (!nuevoEquipo.trim() || !categoriaSeleccionada || !grupoSeleccionado) return;
    await crearEquipo(categoriaSeleccionada, grupoSeleccionado, nuevoEquipo.trim());
    setNuevoEquipo("");
    handleSeleccionarGrupo(grupoSeleccionado);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Administrar Categorías, Grupos y Equipos</h2>
      <form onSubmit={handleCrearCategoria} style={{ marginBottom: 16 }}>
        <input
          value={nuevaCategoria}
          onChange={e => setNuevaCategoria(e.target.value)}
          placeholder="Nueva categoría"
        />
        <button type="submit">Agregar categoría</button>
      </form>
      <div style={{ display: "flex", gap: 32 }}>
        <div>
          <h3>Categorías</h3>
          <ul>
            {categorias.map(cat => (
              <li key={cat.id}>
                <button onClick={() => handleSeleccionarCategoria(cat.id)}>
                  {cat.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {grupoSeleccionado && equipos.length >= 2 && (
            <button onClick={handleGenerarPartidos} disabled={generando} style={{ marginBottom: 12 }}>
              {generando ? "Generando partidos..." : "Generar partidos todos contra todos"}
            </button>
          )}
          {partidosGenerados.length > 0 && (
            <div>
              <h4>Partidos generados:</h4>
              <ul>
                {partidosGenerados.map((p, idx) => (
                  <li key={p.id || idx}>
                    {p.equipoA.nombre} vs {p.equipoB.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Semifinales UI */}
          <div style={{ marginTop: 24, borderTop: '1px solid #ccc', paddingTop: 16 }}>
            <h4>Generar cruces de semifinales</h4>
            <div style={{ marginBottom: 8 }}>
              <label>
                Modo de cruce:
                <select value={modoSemifinal} onChange={e => setModoSemifinal(e.target.value)} style={{ marginLeft: 8 }}>
                  <option value="cruzado">Cruzado (1°A vs 2°B, 1°B vs 2°A)</option>
                  <option value="mismo">Mismo (1°A vs 1°B, 2°A vs 2°B)</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <strong>Clasificados Grupo A:</strong>
                <input type="text" placeholder="1° Grupo A" value={clasificadosA[0]||""} onChange={e=>handleChangeClasificadoA(0,e.target.value)} style={{ margin: 4 }} />
                <input type="text" placeholder="2° Grupo A" value={clasificadosA[1]||""} onChange={e=>handleChangeClasificadoA(1,e.target.value)} style={{ margin: 4 }} />
              </div>
              <div>
                <strong>Clasificados Grupo B:</strong>
                <input type="text" placeholder="1° Grupo B" value={clasificadosB[0]||""} onChange={e=>handleChangeClasificadoB(0,e.target.value)} style={{ margin: 4 }} />
                <input type="text" placeholder="2° Grupo B" value={clasificadosB[1]||""} onChange={e=>handleChangeClasificadoB(1,e.target.value)} style={{ margin: 4 }} />
              </div>
            </div>
            <button onClick={handleGenerarSemifinales} style={{ marginTop: 8 }}>Generar semifinales</button>
            {semifinales.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h5>Cruces de semifinales:</h5>
                <ul>
                  {semifinales.map((s, idx) => (
                    <li key={idx}>{s.equipo1} vs {s.equipo2}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div>
          <h3>Grupos</h3>
          {categoriaSeleccionada && (
            <>
              <form onSubmit={handleCrearGrupo} style={{ marginBottom: 8 }}>
                <input
                  value={nuevoGrupo}
                  onChange={e => setNuevoGrupo(e.target.value)}
                  placeholder="Nuevo grupo"
                />
                <button type="submit">Agregar grupo</button>
              </form>
              <ul>
                {grupos.map(grp => (
                  <li key={grp.id}>
                    <button onClick={() => handleSeleccionarGrupo(grp.id)}>
                      {grp.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3>Equipos</h3>
          {grupoSeleccionado && (
            <>
              <form onSubmit={handleCrearEquipo} style={{ marginBottom: 8 }}>
                <input
                  value={nuevoEquipo}
                  onChange={e => setNuevoEquipo(e.target.value)}
                  placeholder="Nuevo equipo"
                />
                <button type="submit">Agregar equipo</button>
              </form>
              <ul>
                {equipos.map(eq => (
                  <li key={eq.id}>{eq.nombre}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoriasAdmin;
