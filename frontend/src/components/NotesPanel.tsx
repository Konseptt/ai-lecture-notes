import type { NotesData } from "../lib/types";

interface Props {
  data: NotesData;
}

export default function NotesPanel({ data }: Props) {
  return (
    <div className="max-h-[60vh] overflow-y-auto scrollbar-thin space-y-6">
      {data.sections.map((sec, i) => (
        <div key={i}>
          <h3 className="font-bold text-sm mb-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">{sec.heading}</h3>

          {sec.bullets.length > 0 && (
            <ul className="space-y-1 mb-3">
              {sec.bullets.map((b, j) => (
                <li key={j} className="text-sm flex gap-2 items-start">
                  <span className="w-1 h-1 rounded-full bg-neutral-400 mt-2 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {sec.definitions.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {sec.definitions.map((d, j) => (
                <div key={j} className="border-l-2 border-blue-400 pl-3 py-1">
                  <span className="font-semibold text-sm">{d.term}</span>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{d.definition}</p>
                </div>
              ))}
            </div>
          )}

          {sec.highlights.length > 0 && (
            <div className="mb-3 space-y-1">
              {sec.highlights.map((h, j) => (
                <p key={j} className="text-sm bg-accent-light px-3 py-2 rounded-md accent font-medium">💡 {h}</p>
              ))}
            </div>
          )}

          {sec.examples.length > 0 && (
            <div className="mb-3 space-y-1">
              {sec.examples.map((ex, j) => (
                <p key={j} className="text-sm text-neutral-600 dark:text-neutral-400 pl-3 border-l border-emerald-400">🧪 {ex}</p>
              ))}
            </div>
          )}

          {sec.formulas.length > 0 && (
            <div className="mb-3 space-y-1">
              {sec.formulas.map((f, j) => (
                <p key={j} className="font-mono text-sm bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-md">{f}</p>
              ))}
            </div>
          )}
        </div>
      ))}

      {data.action_items.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">☑️ Action Items</h3>
          <ul className="space-y-1.5">
            {data.action_items.map((item, i) => (
              <li key={i} className="text-sm flex gap-2 items-start">
                <input type="checkbox" className="mt-1 accent-[var(--accent)]" readOnly />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.key_terms.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">📖 Key Terms</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.key_terms.map((kt, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold">{kt.term}</span>
                <span className="text-neutral-500"> — {kt.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
