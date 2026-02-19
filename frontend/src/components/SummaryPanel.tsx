import { useState } from "react";
import type { SummaryData } from "../lib/types";

interface Props {
  data: SummaryData;
}

type Tab = "quick" | "detailed" | "exam";

export default function SummaryPanel({ data }: Props) {
  const [tab, setTab] = useState<Tab>("quick");

  return (
    <div>
      <div className="flex gap-4 mb-5">
        {(["quick", "detailed", "exam"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[13px] font-medium pb-1 transition-colors ${
              tab === t ? "accent border-b-2 border-[var(--accent)]" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            }`}
          >
            {t === "quick" ? "Quick" : t === "detailed" ? "Detailed" : "Exam Prep"}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
        {tab === "quick" && (
          <ol className="space-y-2.5">
            {data.quick.points.map((p, i) => (
              <li key={i} className="flex gap-3 items-start text-sm">
                <span className="text-[11px] font-bold text-neutral-400 mt-0.5 w-4 text-right shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
        )}

        {tab === "detailed" && (
          <div className="space-y-5">
            {data.detailed.sections.map((sec, i) => (
              <div key={i}>
                <h3 className="font-bold text-sm mb-1">{sec.heading}</h3>
                <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{sec.content}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "exam" && (
          <div className="space-y-6">
            {data.exam.definitions.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Definitions</h4>
                <div className="space-y-2">
                  {data.exam.definitions.map((d, i) => (
                    <div key={i} className="border-l-2 border-[var(--accent)] pl-3 py-1">
                      <span className="font-semibold text-sm">{d.term}</span>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">{d.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.exam.key_examples.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Key Examples</h4>
                <ul className="space-y-1">
                  {data.exam.key_examples.map((ex, i) => (
                    <li key={i} className="text-sm pl-3 border-l border-neutral-200 dark:border-neutral-700">{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.exam.repeated_points.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Emphasized</h4>
                <ul className="space-y-1">
                  {data.exam.repeated_points.map((rp, i) => (
                    <li key={i} className="text-sm flex gap-2"><span className="accent font-bold">!</span>{rp}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.exam.potential_questions.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Likely Questions</h4>
                <div className="space-y-3">
                  {data.exam.potential_questions.map((q, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium">Q: {q.question}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 italic">Hint: {q.hint}</p>
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
