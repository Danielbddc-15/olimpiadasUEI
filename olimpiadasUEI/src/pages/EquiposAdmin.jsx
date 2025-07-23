// src/pages/EquiposAdmin.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import EquipoForm from "../components/EquipoForm";
import "../styles/equipos.css";

const EquiposAdmin = () => {
  const [equipos, setEquipos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(null);

  const fetchEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(data);
  };

  useEffect(() => {
    fetchEquipos();
  }, []);

  const handleAdd = async (equipo) => {
    await addDoc(collection(db, "equipos"), equipo);
    fetchEquipos();
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "equipos", id));
    fetchEquipos();
  };

  const handleEdit = (equipo) => {
    setEditData(equipo);
    setEditId(equipo.id);
  };

  const handleUpdate = async (equipo) => {
    await updateDoc(doc(db, "equipos", editId), equipo);
    setEditId(null);
    setEditData(null);
    fetchEquipos();
  };

  return (
    <div className="equipos-admin">
      <h2 className="title">Gestión de Equipos</h2>
      <EquipoForm
        onSubmit={editId ? handleUpdate : handleAdd}
        initialData={editData}
        onCancel={() => {
          setEditId(null);
          setEditData(null);
        }}
      />
      <table className="equipos-table">
        <thead>
          <tr>
            <th>Curso</th>
            <th>Paralelo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((equipo) => (
            <tr key={equipo.id}>
              <td>{equipo.curso}</td>
              <td>{equipo.paralelo}</td>
              <td>
                <button onClick={() => handleEdit(equipo)}>Editar</button>
                <button onClick={() => handleDelete(equipo.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EquiposAdmin;
