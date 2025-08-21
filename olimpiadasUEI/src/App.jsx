import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import PublicHome from "./pages/PublicHome";
import PublicMatchDetail from "./pages/PublicMatchDetail";
import PublicVoleyMatchDetail from "./pages/PublicVoleyMatchDetail";
import PublicBasquetMatchDetail from "./pages/PublicBasquetMatchDetail";
import PrivateRoute from "./routes/PrivateRoute";
import DisciplineSelector from "./pages/DisciplineSelector";
import AdminMatches from "./pages/AdminMatches";
import AdminStandings from "./pages/AdminStandings";
import AdminHorarios from "./pages/AdminHorarios";
import AdminHome from "./pages/AdminHome";
import AdminTeams from "./pages/AdminTeams";
import AdminMatchDetail from "./pages/AdminMatchDetail";
import AdminVoleyMatchDetail from "./pages/AdminVoleyMatchDetail";
import AdminBasquetMatchDetail from "./pages/AdminBasquetMatchDetail";
import AdminUsers from "./pages/AdminUsers";
import AdminCronogramas from "./pages/AdminCronogramas";
import ProfesorVoleyMatchDetail from "./pages/ProfesorVoleyMatchDetail";
import ProfesorBasquetMatchDetail from "./pages/ProfesorBasquetMatchDetail";

// Solo usarás estas páginas para profesor
import ProfesorMatches from "./pages/ProfesorMatches";
import ProfesorStandings from "./pages/ProfesorStandings";
import ProfesorHorarios from "./pages/ProfesorHorarios";
import ProfesorHome from "./pages/ProfesorHome";
import ProfesorMatchDetail from "./pages/ProfesorMatchDetail";
import ProfesorTeams from "./pages/ProfesorTeams";
import CategoriasAdmin from "./components/CategoriasAdmin";

// Notification system
import { NotificationProvider } from "./context/NotificationContext";
import NotificationContainer from "./components/CustomNotification";

function App() {
  return (
    <NotificationProvider>
      <Router>
        <NotificationContainer />
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />

        {/* Selector para invitados */}
        <Route path="/selector" element={<DisciplineSelector />} /> 

        {/* Vista pública de partidos según la disciplina */}
        <Route path="/matches/:discipline" element={<PublicHome />} />

        {/* RUTAS PÚBLICAS DE DETALLES DE PARTIDOS */}
        {/* Detalle público de partido - FÚTBOL */}
        <Route path="/public/partido/:matchId" element={<PublicMatchDetail />} />
        
        {/* Nuevas rutas públicas con patrón discipline/match */}
        <Route path="/public/:discipline/match/:matchId" element={<PublicMatchDetail />} />
        
        {/* Detalle público de partido - VÓLEY */}
        <Route path="/public-voley-match-detail/:matchId" element={<PublicVoleyMatchDetail />} />
        
        {/* Detalle público de partido - BÁSQUET */}
        <Route path="/public-basquet-match-detail/:matchId" element={<PublicBasquetMatchDetail />} />

        {/* RUTAS ADMIN */}
        <Route
          path="/equipos"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminTeams />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminHome />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminUsers />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/:discipline"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminHome />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/:discipline/equipos"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminTeams />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/:discipline/partidos"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminMatches />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del admin - FÚTBOL */}
        <Route
          path="/admin/partido/:matchId"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminMatchDetail />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del admin - VÓLEY */}
        <Route
          path="/admin-voley-match-detail/:matchId"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminVoleyMatchDetail />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del admin - BÁSQUET */}
        <Route
          path="/admin-basquet-match-detail/:matchId"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminBasquetMatchDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/:discipline/tabla"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminStandings />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/:discipline/horarios"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminHorarios />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/cronogramas"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <AdminCronogramas />
            </PrivateRoute>
          }
        />

        {/* RUTAS PROFESOR SOLO ESTAS */}
        <Route
          path="/profesor"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorHome />
            </PrivateRoute>
          }
        />
        <Route
          path="/profesor/:discipline/partidos"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorMatches />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del profesor - FÚTBOL */}
        <Route
          path="/profesor-match-detail/:matchId"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorMatchDetail />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del profesor - VÓLEY */}
        <Route
          path="/profesor-voley-match-detail/:matchId"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorVoleyMatchDetail />
            </PrivateRoute>
          }
        />
        {/* Ruta para detalle de partido del profesor - BÁSQUET */}
        <Route
          path="/profesor-basquet-match-detail/:matchId"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorBasquetMatchDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/profesor/:discipline/tabla"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorStandings />
            </PrivateRoute>
          }
        />
        <Route
          path="/profesor/:discipline/horarios"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorHorarios />
            </PrivateRoute>
          }
        />
        <Route
          path="/profesor/:discipline/equipos"
          element={
            <PrivateRoute allowedRoles={["profesor"]}>
              <ProfesorTeams />
            </PrivateRoute>
          }
        />
      </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
