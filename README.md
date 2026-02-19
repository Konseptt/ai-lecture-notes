# AI Audio Lecture Note Taker

An AI-powered web application that records classroom audio, transcribes it using Google Gemini, and generates summaries and structured study notes automatically.

## Features

- **Audio Recording** -- Record lectures directly in the browser with pause/resume, live waveform visualization, and noise cancellation
- **AI Transcription** -- Converts audio to timestamped text using Gemini 2.0 Flash
- **Three Summary Types** -- Quick bullet points, detailed topic breakdowns, and exam-focused review material
- **Structured Notes** -- Auto-generated study notes with definitions, highlights, examples, formulas, and action items
- **Audio Playback** -- Variable-speed playback with clickable timestamps to jump through the recording
- **Search** -- Find keywords across transcripts
- **Export** -- Download transcripts, summaries, and notes as TXT or PDF; download audio as WebM
- **Local Storage** -- All data stored in browser IndexedDB (nothing sent to third-party servers except Gemini API)
- **Dark Mode** -- Toggle between light and dark themes

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Google Gemini API key** -- Get one at [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_api_key_here
```

Start the backend server:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. **Record** -- Click "Record" in the sidebar, allow microphone access, and start recording your lecture
2. **Save** -- When done, stop the recording, give it a title/course/tags, and click "Save & Process"
3. **Wait** -- The app sends your audio to Gemini for transcription, then generates summaries and notes (typically 30-90 seconds)
4. **Review** -- Browse the transcript, summaries, and structured notes in the tabbed interface
5. **Playback** -- Use the audio player to re-listen; click timestamps to jump to specific moments
6. **Export** -- Download your materials as TXT, PDF, or audio files

## Project Structure

```
backend/
  main.py                 # FastAPI app with API routes
  services/
    gemini_service.py     # Gemini API integration
  requirements.txt
  .env.example

frontend/
  src/
    App.tsx               # Main app with routing and sidebar
    components/
      AudioRecorder.tsx   # Recording UI with waveform
      LectureList.tsx     # Dashboard with search/filter
      LectureView.tsx     # Lecture detail + processing flow
      AudioPlayer.tsx     # Playback controls
      TranscriptPanel.tsx # Searchable transcript
      SummaryPanel.tsx    # Three summary views
      NotesPanel.tsx      # Structured notes display
      ExportButton.tsx    # Export dropdown
    lib/
      api.ts              # Backend API client
      storage.ts          # IndexedDB operations
      types.ts            # TypeScript interfaces
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/transcribe` | Upload audio, returns transcript with timestamps |
| POST | `/api/summarize` | Send transcript text, returns quick/detailed/exam summaries |
| POST | `/api/notes` | Send transcript text, returns structured study notes |

## Tech Stack

- **Backend**: Python, FastAPI, Google GenAI SDK
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **AI**: Google Gemini 2.0 Flash
- **Storage**: IndexedDB (browser-local)
- **Icons**: Lucide React
- **PDF**: jsPDF
