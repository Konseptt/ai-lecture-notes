import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sun, Moon, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import LectureList from "./components/LectureList";
import AudioRecorder from "./components/AudioRecorder";
import LectureView from "./components/LectureView";

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("theme") === "dark"
  );
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (location.pathname === "/login" || location.pathname === "/signup") {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800" style={{ background: "var(--bg)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
                <span className="text-white text-xs font-extrabold">L</span>
              </div>
              <span className="font-bold text-[15px] tracking-tight hidden sm:block">lectur.ai</span>
            </NavLink>

            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`
                }
              >
                Library
              </NavLink>
              <NavLink
                to="/record"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-accent-light text-[var(--accent)]"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`
                }
              >
                Record
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <span className="text-xs text-neutral-400 hidden sm:block mr-1">{user.name || user.email}</span>
            )}
            <button
              onClick={() => setDark(!dark)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user && (
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        <Routes>
          <Route path="/" element={<ProtectedRoute><LectureList /></ProtectedRoute>} />
          <Route path="/record" element={<ProtectedRoute><AudioRecorder /></ProtectedRoute>} />
          <Route path="/lecture/:id" element={<ProtectedRoute><LectureView /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </main>

      <footer className="max-w-4xl mx-auto px-5 pb-8">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-600">
          built for students who hate taking notes
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
