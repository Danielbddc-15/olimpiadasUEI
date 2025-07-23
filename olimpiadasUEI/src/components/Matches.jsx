function Matches({ role }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Partidos</h2>

      {role === "admin" && (
        <div>
          <p>Puede crear, editar y eliminar partidos.</p>
          {/* Aquí van los botones y formularios del admin */}
        </div>
      )}

      {role === "profesor" && (
        <div>
          <p>Puede editar solo los marcadores.</p>
          {/* Aquí puede haber una lista de partidos con campos editables de marcador */}
        </div>
      )}
    </div>
  );
}

export default Matches;
