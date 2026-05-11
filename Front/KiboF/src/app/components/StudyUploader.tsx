import { useRef, useState } from "react";
import {
  BookOpen,
  Check,
  FileText,
  ListChecks,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

// ─── Config ─────────────────────────────────────────────────────────────────
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "http://localhost:3000";

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface StudyQuizQuestion {
  id: number;
  question: string;
  question_type: "multiple_choice" | "open" | "true_false";
  options: string[];
  correct_answer: string | null;
  explanation: string | null;
  position: number;
}

export interface StudyResult {
  ingest: {
    resourceId: number;
    documentId: number;
    chunksInserted: number;
    metadata: {
      pageCount: number;
      extractedTextLength: number;
      needsOcr: boolean;
      lowTextPages: number[];
    };
  };
  resource: { id: number; title: string; subject: string | null; gradeLevel: string | null };
  summary: { id: number; content: string; summary_type: string };
  keyConcepts: { term: string; definition: string }[];
  outline: string[];
  quiz: {
    quiz: { id: number; title: string; subject: string | null; topic: string | null };
    questions: StudyQuizQuestion[];
  };
}

interface Progress {
  stage: string;
  percent: number;
  label: string;
}

interface Props {
  /** URL del backend Kibo. Default: VITE_BACKEND_URL o http://localhost:3000 */
  backendUrl?: string;
  /** Callback con el resultado final (para integrar con el resto de la app). */
  onDone?: (result: StudyResult) => void;
}

// ─── Mapeo de etapas SSE a etiquetas y % de progreso ────────────────────────
const STAGE_MAP: Record<string, { percent: number; label: string }> = {
  upload_received: { percent: 5, label: "Archivo recibido" },
  parsing_pdf: { percent: 15, label: "Extrayendo texto del PDF..." },
  pdf_parsed: { percent: 25, label: "Texto extraído" },
  embeddings_start: { percent: 30, label: "Generando embeddings..." },
  embeddings_done: { percent: 60, label: "Embeddings listos" },
  db_start: { percent: 65, label: "Guardando en base de datos..." },
  ingest_done: { percent: 70, label: "Recurso indexado" },
  study_llm_start: { percent: 75, label: "Kibo está leyendo el material..." },
  study_llm_done: { percent: 95, label: "Kibo terminó de analizar" },
  done: { percent: 100, label: "¡Listo!" },
  error: { percent: 0, label: "Error" },
};

// ─── Componente ─────────────────────────────────────────────────────────────
export function StudyUploader({ backendUrl = BACKEND_URL, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    subject: "",
    gradeLevel: "",
    questionCount: 5,
  });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    stage: "idle",
    percent: 0,
    label: "",
  });
  const [result, setResult] = useState<StudyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStageEvent = (event: { stage: string; [k: string]: any }) => {
    const conf = STAGE_MAP[event.stage] || { percent: progress.percent, label: event.stage };
    setProgress({ stage: event.stage, percent: conf.percent, label: conf.label });

    // Log descriptivo por etapa
    const detailBits: string[] = [conf.label];
    if (event.stage === "pdf_parsed" && event.pageCount) {
      detailBits.push(`${event.pageCount} páginas, ${event.extractedChars ?? "?"} caracteres`);
    }
    if (event.stage === "embeddings_start" && event.chunks) {
      detailBits.push(`${event.chunks} fragmentos`);
    }
    if (event.stage === "embeddings_done" && event.seconds) {
      detailBits.push(`${event.seconds}s`);
    }
    if (event.stage === "ingest_done" && event.chunksInserted) {
      detailBits.push(`${event.chunksInserted} fragmentos guardados`);
    }
    setLogs((prev) => [...prev, detailBits.filter(Boolean).join(" · ")]);

    if (event.stage === "done") {
      const { stage, ...rest } = event as any;
      const full = rest as StudyResult;
      setResult(full);
      onDone?.(full);
    }
    if (event.stage === "error") {
      setError(event.error || "Error desconocido");
      setUploading(false);
    }
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);
    setLogs([]);
    setProgress({ stage: "idle", percent: 0, label: "Subiendo archivo..." });

    try {
      const fd = new FormData();
      fd.append("pdf", file);
      if (form.title) fd.append("title", form.title);
      if (form.subject) fd.append("subject", form.subject);
      if (form.gradeLevel) fd.append("gradeLevel", form.gradeLevel);
      fd.append("questionCount", String(form.questionCount));

      const response = await fetch(
        `${backendUrl}/resources/ingest/pdf-file/study/stream`,
        { method: "POST", body: fd },
      );

      if (!response.ok || !response.body) {
        throw new Error(`Fallo la subida (${response.status})`);
      }

      // Parse SSE manualmente (EventSource no soporta POST multipart)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const json = raw.slice(5).trim();
          if (!json) continue;
          try {
            const event = JSON.parse(json);
            handleStageEvent(event);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || "Error desconocido");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLogs([]);
    setProgress({ stage: "idle", percent: 0, label: "" });
    if (inputRef.current) inputRef.current.value = "";
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-foreground mb-2 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          Subir PDF para estudiar
        </h1>
        <p className="text-muted-foreground">
          Kibo indexará el PDF y generará un resumen, conceptos clave y un quiz automáticamente.
        </p>
      </div>

      {/* Formulario */}
      {!result && (
        <div className="bg-card rounded-3xl shadow-xl border border-border p-6 md:p-8 mb-6">
          <div className="space-y-4">
            {/* File picker */}
            <label className="block">
              <span className="text-foreground mb-2 block">Archivo PDF</span>
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all ${
                  file ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploading}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {file && !uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Quitar archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </label>

            {/* Campos opcionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-foreground mb-2 block text-sm">
                  Título (opcional)
                </span>
                <input
                  type="text"
                  value={form.title}
                  disabled={uploading}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Deja vacío para usar el nombre del archivo"
                  className="w-full px-4 py-2 bg-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-foreground mb-2 block text-sm">Materia</span>
                <input
                  type="text"
                  value={form.subject}
                  disabled={uploading}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Matemáticas, Biología..."
                  className="w-full px-4 py-2 bg-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-foreground mb-2 block text-sm">Nivel</span>
                <input
                  type="text"
                  value={form.gradeLevel}
                  disabled={uploading}
                  onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
                  placeholder="Secundaria, Preparatoria..."
                  className="w-full px-4 py-2 bg-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-foreground mb-2 block text-sm">
                  Preguntas del quiz
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.questionCount}
                  disabled={uploading}
                  onChange={(e) =>
                    setForm({ ...form, questionCount: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            {/* Botón */}
            <button
              type="button"
              disabled={!file || uploading}
              onClick={startUpload}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Subir y generar estudio
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      {(uploading || progress.percent > 0) && !result && (
        <div className="bg-card rounded-3xl shadow-xl border border-border p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-foreground font-medium">{progress.label}</span>
            <span className="text-muted-foreground text-sm">{progress.percent}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {/* Log de etapas */}
          {logs.length > 0 && (
            <div className="mt-6 space-y-1 text-sm">
              {logs.slice(-8).map((line, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-primary" />
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-destructive flex items-start gap-3">
          <X className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">No se pudo procesar el PDF</p>
            <p className="text-sm mt-1 opacity-90">{error}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 px-3 py-1.5 bg-destructive text-white rounded-lg text-sm hover:opacity-90"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && <StudyResultView result={result} onReset={reset} />}
    </div>
  );
}

// ─── Vista de resultados ────────────────────────────────────────────────────
function StudyResultView({
  result,
  onReset,
}: {
  result: StudyResult;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"summary" | "concepts" | "outline" | "quiz">(
    "summary",
  );

  const tabs = [
    { id: "summary" as const, label: "Resumen", icon: FileText },
    { id: "concepts" as const, label: "Conceptos clave", icon: BookOpen },
    { id: "outline" as const, label: "Temario", icon: ListChecks },
    { id: "quiz" as const, label: `Quiz (${result.quiz.questions.length})`, icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl shadow-xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-foreground">{result.resource.title}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {result.resource.subject || "Sin materia"} ·{" "}
              {result.ingest.metadata.pageCount} páginas ·{" "}
              {result.ingest.chunksInserted} fragmentos indexados
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm"
          >
            Subir otro
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap border-b border-border pb-3 mb-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  active
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "bg-secondary text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        {tab === "summary" && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
            {result.summary.content}
          </div>
        )}

        {tab === "concepts" && (
          <div className="space-y-3">
            {result.keyConcepts.length === 0 && (
              <p className="text-muted-foreground">No se generaron conceptos.</p>
            )}
            {result.keyConcepts.map((c, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-secondary border border-border"
              >
                <h4 className="text-foreground mb-1">{c.term}</h4>
                <p className="text-muted-foreground text-sm">{c.definition}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "outline" && (
          <ol className="list-decimal list-inside space-y-2 text-foreground">
            {result.outline.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        )}

        {tab === "quiz" && <QuizView questions={result.quiz.questions} />}
      </div>
    </div>
  );
}

// ─── Quiz interactivo ───────────────────────────────────────────────────────
function QuizView({ questions }: { questions: StudyQuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const correctCount = questions.reduce((n, q) => {
    if (!q.correct_answer) return n;
    return answers[q.id] === q.correct_answer ? n + 1 : n;
  }, 0);

  return (
    <div className="space-y-5">
      {questions.map((q, i) => {
        const sel = answers[q.id];
        const right = submitted && sel === q.correct_answer;
        const wrong = submitted && sel && sel !== q.correct_answer;
        return (
          <div
            key={q.id}
            className="p-4 rounded-2xl bg-secondary border border-border"
          >
            <p className="text-foreground font-medium mb-3">
              {i + 1}. {q.question}
            </p>

            <div className="space-y-2">
              {(q.options || []).map((opt, k) => {
                const isSelected = sel === opt;
                const isCorrect = submitted && opt === q.correct_answer;
                const isSelectedWrong = submitted && isSelected && opt !== q.correct_answer;
                return (
                  <button
                    type="button"
                    key={k}
                    disabled={submitted}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                    className={`w-full text-left px-4 py-2 rounded-xl border transition-all ${
                      isCorrect
                        ? "border-green-500 bg-green-500/10 text-foreground"
                        : isSelectedWrong
                        ? "border-destructive bg-destructive/10 text-foreground"
                        : isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {submitted && q.explanation && (
              <p className={`mt-3 text-sm ${right ? "text-green-600" : wrong ? "text-destructive" : "text-muted-foreground"}`}>
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {!submitted ? (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Revisar respuestas
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-card border border-border text-center">
          <p className="text-foreground">
            Acertaste <strong>{correctCount}</strong> de{" "}
            <strong>{questions.length}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="mt-3 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

export default StudyUploader;
