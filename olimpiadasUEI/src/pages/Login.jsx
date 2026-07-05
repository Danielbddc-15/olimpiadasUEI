import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/login.css";
import logo from "../Logo/logo192.png";

function Login() {
  const navigate = useNavigate();
  const { login, loginAsGuest, user, loading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [animationPhase, setAnimationPhase] = useState("sponsor"); // "sponsor", "transition", "login"

  // Verificar si ya hay un usuario autenticado y redirigir
  useEffect(() => {
    if (!loading && user) {
      if (user.role === "ADMIN") {
        navigate(`/admin`);
      } else if (user.role === "PROFESOR") {
        navigate(`/profesor`);
      } else {
        navigate("/selector");
      }
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
      const loggedUser = await login(email, password);
      
      // Redirigir según el rol
      if (loggedUser.role === "ADMIN") {
        navigate(`/admin`);
      } else if (loggedUser.role === "PROFESOR") {
        navigate(`/profesor`);
      } else {
        navigate("/selector");
      }
    } catch (error) {
      console.error("Error de login:", error);
      const errorMsg = error.response?.data?.message || error.message || "Error desconocido";
      alert(`Error al iniciar sesión: ${errorMsg}`);
    }
  };

  const handleGuestAccess = () => {
    loginAsGuest();
    navigate("/selector");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
