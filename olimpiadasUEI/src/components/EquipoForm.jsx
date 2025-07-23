// src/components/EquipoForm.jsx
import { useState, useEffect } from "react";

const EquipoForm = ({ onSubmit, initialData, onCancel }) => {
  const [curso, setCurso] = useState("");
  const [paralelo, setParalelo] = useState("");

  useEffect(() => {
    if (initialData) {
      setCurso(initialData.curso);
      setParalelo(initialData.paralelo);
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (curso && paralelo) {
      onSubmit({ curso, paralelo });
      setCurso("");
      setParalelo("");
    }
  };

  return (
    <form className="equipo-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Curso"
        value={curso}
        onChange={(e) => setCurso(e.target.value)}
      />
      <input
        type="text"
        placeholder="Paralelo"
        value={paralelo}
        onChange={(e) => setParalelo(e.target.value)}
      />
      <div className="form-buttons">
        <button type="submit">{initialData ? "Actualizar" : "Agregar"}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};

export default EquipoForm;
