import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import LectureList from "./components/LectureList";
import AudioRecorder from "./components/AudioRecorder";
import LectureView from "./components/LectureView";

export default function App() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("theme") === "dark"
  );
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const isRecord = location.pathname === "/record";

  return (
    <div className="min-h-screen">
      {/* Top nav - simple, like a real app */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800" style={{ background: "var(--bg)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo - just text, confident */}
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

          <button
            onClick={() => setDark(!dark)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-5 py-8">
        <Routes>
          <Route path="/" element={<LectureList />} />
          <Route path="/record" element={<AudioRecorder />} />
          <Route path="/lecture/:id" element={<LectureView />} />
        </Routes>
      </main>

      {/* Footer - tiny, human touch */}
      <footer className="max-w-4xl mx-auto px-5 pb-8">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-600">
          built for students who hate taking notes
        </p>
      </footer>
    </div>
  );
}
