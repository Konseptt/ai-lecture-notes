import { useState } from "react";
import { Zap, BookOpen, GraduationCap } from "lucide-react";
import type { SummaryData } from "../lib/types";

interface Props {
  data: SummaryData;
}

type Tab = "quick" | "detailed" | "exam";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "quick", label: "Quick", icon: <Zap className="w-4 h-4" /> },
  { key: "detailed", label: "Detailed", icon: <BookOpen className="w-4 h-4" /> },
  { key: "exam", label: "Exam Prep", icon: <GraduationCap className="w-4 h-4" /> },
];

export default function SummaryPanel({ data }: Props) {
  const [tab, setTab] = useState<Tab>("quick");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white dark:bg-gray-900 shadow-sm text-indigo-600 dark:text-indigo-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {tab === "quick" && (
          <div className="space-y-2">
            {data.quick.points.map((p, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "detailed" && (
          <div className="space-y-6">
            {data.detailed.sections.map((sec, i) => (
              <div key={i}>
                <h3 className="font-semibold text-base mb-2">{sec.heading}</h3>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{sec.content}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "exam" && (
          <div className="space-y-6">
            {data.exam.definitions.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">Key Definitions</h3>
                <div className="space-y-2">
                  {data.exam.definitions.map((d, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                      <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">{d.term}</span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{d.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.exam.key_examples.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">Key Examples</h3>
                <ul className="space-y-1.5">
                  {data.exam.key_examples.map((ex, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-indigo-500">--</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.exam.repeated_points.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">Emphasized Points</h3>
                <ul className="space-y-1.5">
                  {data.exam.repeated_points.map((rp, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-yellow-500 font-bold">!</span>
                      {rp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.exam.potential_questions.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">Potential Exam Questions</h3>
                <div className="space-y-3">
                  {data.exam.potential_questions.map((q, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                      <p className="text-sm font-medium">{q.question}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Hint: {q.hint}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
