import { collection, doc, setDoc, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// Crear una nueva categoría
export async function crearCategoria(nombre) {
  const ref = await addDoc(collection(db, "categorias"), { nombre });
  return ref.id;
}

// Crear un grupo dentro de una categoría
export async function crearGrupo(categoriaId, nombreGrupo) {
  const ref = doc(collection(db, `categorias/${categoriaId}/grupos`));
  await setDoc(ref, { nombre: nombreGrupo });
  return ref.id;
}

// Crear un equipo dentro de un grupo de una categoría
export async function crearEquipo(categoriaId, grupoId, nombreEquipo) {
  const ref = doc(collection(db, `categorias/${categoriaId}/grupos/${grupoId}/equipos`));
  await setDoc(ref, { nombre: nombreEquipo });
  return ref.id;
}

// Obtener todas las categorías
export async function obtenerCategorias() {
  const snapshot = await getDocs(collection(db, "categorias"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Obtener grupos de una categoría
export async function obtenerGrupos(categoriaId) {
  const snapshot = await getDocs(collection(db, `categorias/${categoriaId}/grupos`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Obtener equipos de un grupo de una categoría
export async function obtenerEquipos(categoriaId, grupoId) {
  const snapshot = await getDocs(collection(db, `categorias/${categoriaId}/grupos/${grupoId}/equipos`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
