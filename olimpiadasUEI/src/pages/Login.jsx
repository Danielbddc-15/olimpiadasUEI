import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import "../styles/login.css";
import logo from "../Logo/logo192.png";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [animationPhase, setAnimationPhase] = useState("sponsor"); // "sponsor", "transition", "login"
  const [user, loading] = useAuthState(auth);

  // Configurar persistencia de autenticación al cargar el componente
  useEffect(() => {
    const configurePersistence = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log("Persistencia de autenticación configurada");
      } catch (error) {
        console.error("Error configurando persistencia:", error);
      }
    };
    configurePersistence();
  }, []);

  // Verificar si ya hay un usuario autenticado y redirigir
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (user && !loading) {
        try {
          // Obtener el rol desde Firestore
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const role = docSnap.data().role;
            
            // Redirigir según el rol
            if (role === "admin") {
              navigate(`/admin`);
            } else if (role === "profesor") {
              navigate(`/profesor`);
            } else {
              navigate("/selector");
            }
          } else {
            // Si no hay documento, tratar como invitado
            navigate("/selector");
          }
        } catch (error) {
          console.error("Error verificando usuario:", error);
        }
      }
    };

    if (!loading) {
      checkUserAndRedirect();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setAnimationPhase("transition");
    }, 2500); // Show sponsor message for 2.5 seconds

    const timer2 = setTimeout(() => {
      setAnimationPhase("login");
    }, 3500); // Show login after 3.5 seconds total

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const loggedUser = userCredential.user;

      // Obtener el rol desde Firestore
      const docRef = doc(db, "users", loggedUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;

        // Guardar información de sesión en localStorage
        localStorage.setItem('userRole', role);
        localStorage.setItem('userEmail', loggedUser.email);
        localStorage.setItem('sessionTimestamp', Date.now().toString());

        // Redirigir según el rol
        if (role === "admin") {
          navigate(`/admin`);
        } else if (role === "profesor") {
          navigate(`/profesor`);
        }
      } else {
        // Si no hay documento, tratar como invitado
        localStorage.setItem('userRole', 'guest');
        navigate("/selector");
      }
    } catch (error) {
      console.error("Error de login:", error);
      alert("Credenciales incorrectas");
    }
  };

  const handleGuestAccess = () => {
    // Limpiar cualquier sesión previa
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('sessionTimestamp');
    navigate("/selector");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="login-bg">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      {animationPhase === "sponsor" && (
        <h2 className="sponsorship-title sponsor-fade-in">
          Auspiciado por el comité de padres de familia
        </h2>
      )}
      {animationPhase === "transition" && (
        <h2 className="sponsorship-title sponsor-fade-out">
          Auspiciado por el comité de padres de familia
        </h2>
      )}
      {animationPhase === "login" && (
        <div className="cardview-container login-fade-in">
          <div className="logo-container">
            <img src={logo} alt="Logo Olimpiadas UEI" className="logo-login" />
          </div>
          <div className="header-container">
            <h1 className="login-title">Iniciar sesión</h1>
            <p className="login-subtitle">Accede a las Olimpiadas UEI</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <div className="input-wrapper">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input"
                />
              </div>
            </div>
            <div className="input-group">
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="password-toggle-btn"
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div className="button-group">
              <button type="submit" className="primary-btn">
                <span className="btn-content">
                  <span className="btn-icon">🚀</span>
                  Ingresar
                </span>
              </button>
              <button
                type="button"
                onClick={handleGuestAccess}
                className="secondary-btn"
              >
                <span className="btn-content">
                  <span className="btn-icon">👤</span>
                  Ingresar como invitado
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Copyright Footer */}
      <footer className="copyright-footer">
        <p className="copyright-text">
          © 2025 Elaborado por el <strong>Comité de Padres de Familia</strong> en colaboración con <strong>FACCI ULEAM</strong>
        </p>
      </footer>
    </div>
  );
}

export default Login;
