export interface TranscriptSegment {
  time: string;
  text: string;
}

export interface TranscriptData {
  transcript: string;
  segments: TranscriptSegment[];
}

export interface QuickSummary {
  title: string;
  points: string[];
}

export interface DetailedSection {
  heading: string;
  content: string;
}

export interface DetailedSummary {
  title: string;
  sections: DetailedSection[];
}

export interface ExamDefinition {
  term: string;
  definition: string;
}

export interface ExamQuestion {
  question: string;
  hint: string;
}

export interface ExamSummary {
  title: string;
  definitions: ExamDefinition[];
  key_examples: string[];
  repeated_points: string[];
  potential_questions: ExamQuestion[];
}

export interface SummaryData {
  quick: QuickSummary;
  detailed: DetailedSummary;
  exam: ExamSummary;
}

export interface NoteDefinition {
  term: string;
  definition: string;
}

export interface NoteSection {
  heading: string;
  bullets: string[];
  definitions: NoteDefinition[];
  highlights: string[];
  examples: string[];
  formulas: string[];
}

export interface NotesData {
  title: string;
  sections: NoteSection[];
  action_items: string[];
  key_terms: NoteDefinition[];
}

export interface Lecture {
  id: string;
  title: string;
  course: string;
  date: string;
  duration: number;
  tags: string[];
  audioBlob?: Blob;
  transcript?: TranscriptData;
  summary?: SummaryData;
  notes?: NotesData;
  status: "recording" | "transcribed" | "summarizing" | "generating_notes" | "complete" | "error";
  errorMessage?: string;
}
