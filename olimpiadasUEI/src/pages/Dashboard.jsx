import { useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import Matches from "../components/Matches";
import Loading from "../components/Loading"; // opcional: muestra un "Cargando..."

function Dashboard() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const ref = doc(db, "users", user.uid);
          const docSnap = await getDoc(ref);
          if (docSnap.exists()) {
            setRole(docSnap.data().role); // ejemplo: 'admin' o 'profesor'
          } else {
            setRole("invitado");
          }
        }
      } catch (error) {
        console.error("Error al obtener el rol:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Panel Principal ({role})</h1>

      {role === "admin" && (
        <Matches role="admin" />
      )}

      {role === "profesor" && (
        <Matches role="profesor" />
      )}

      {role !== "admin" && role !== "profesor" && (
        <p>No tienes permisos para acceder a esta vista.</p>
      )}
    </div>
  );
}

export default Dashboard;
