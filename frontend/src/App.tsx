import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Mic, LayoutDashboard, Sun, Moon, GraduationCap } from "lucide-react";
import LectureList from "./components/LectureList";
import AudioRecorder from "./components/AudioRecorder";
import LectureView from "./components/LectureView";

export default function App() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const navLink = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
          isActive
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`
      }
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-16 lg:w-64 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 lg:p-4 gap-2 shrink-0">
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <GraduationCap className="w-8 h-8 text-indigo-600 shrink-0" />
          <span className="hidden lg:inline text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            LectureAI
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navLink("/", <LayoutDashboard className="w-5 h-5 shrink-0" />, "Dashboard")}
          {navLink("/record", <Mic className="w-5 h-5 shrink-0" />, "Record")}
        </nav>

        <div className="mt-auto">
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all w-full"
          >
            {dark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            <span className="hidden lg:inline">{dark ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<LectureList />} />
            <Route path="/record" element={<AudioRecorder />} />
            <Route path="/lecture/:id" element={<LectureView />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
