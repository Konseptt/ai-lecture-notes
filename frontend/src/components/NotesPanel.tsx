import type { NotesData } from "../lib/types";
import { FileText, Lightbulb, BookOpen, FlaskConical, CheckSquare, List } from "lucide-react";

interface Props {
  data: NotesData;
}

export default function NotesPanel({ data }: Props) {
  return (
    <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
      {/* Main sections */}
      {data.sections.map((sec, i) => (
        <div key={i}>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            {sec.heading}
          </h3>

          {sec.bullets.length > 0 && (
            <ul className="space-y-1.5 mb-3 ml-1">
              {sec.bullets.map((b, j) => (
                <li key={j} className="text-sm flex gap-2 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 mt-2 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {sec.definitions.length > 0 && (
            <div className="space-y-2 mb-3">
              {sec.definitions.map((d, j) => (
                <div key={j} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-3">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{d.term}</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{d.definition}</p>
                </div>
              ))}
            </div>
          )}

          {sec.highlights.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {sec.highlights.map((h, j) => (
                <div key={j} className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900 rounded-xl p-3">
                  <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm">{h}</p>
                </div>
              ))}
            </div>
          )}

          {sec.examples.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {sec.examples.map((ex, j) => (
                <div key={j} className="flex items-start gap-2 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-xl p-3">
                  <FlaskConical className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm">{ex}</p>
                </div>
              ))}
            </div>
          )}

          {sec.formulas.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {sec.formulas.map((f, j) => (
                <div key={j} className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-xl p-3 font-mono text-sm">
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Action Items */}
      {data.action_items.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-orange-500" />
            Action Items
          </h3>
          <ul className="space-y-1.5">
            {data.action_items.map((item, i) => (
              <li key={i} className="text-sm flex gap-2 items-start">
                <span className="w-5 h-5 rounded border-2 border-orange-300 dark:border-orange-700 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Terms Glossary */}
      {data.key_terms.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <List className="w-5 h-5 text-teal-500" />
            Key Terms Glossary
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.key_terms.map((kt, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">{kt.term}</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{kt.definition}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
