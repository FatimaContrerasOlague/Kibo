// src/services/tutor.js
//
// Logica del tutor: assignments, recomendaciones, resumenes y quizzes.

const db = require("../db");
const { getEmbedding } = require("./embeddings");
const { generateJson, generateText } = require("./ai");
const { formatChunkSource, searchRelevantChunks } = require("./search");

const allowedQuestionTypes = new Set(["multiple_choice", "open", "true_false"]);

function normalizeQuestionType(type) {
  return allowedQuestionTypes.has(type) ? type : "multiple_choice";
}

async function listAssignments({
  userId = null,
  status = null,
  limit = 50,
  offset = 0,
} = {}) {
  const filters = [];
  const params = [];

  if (userId) {
    params.push(userId);
    filters.push(`user_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`status = $${params.length}`);
  }

  params.push(Number(limit) || 50);
  const limitParam = `$${params.length}`;
  params.push(Number(offset) || 0);
  const offsetParam = `$${params.length}`;

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await db.query(
    `
    SELECT *
    FROM public.assignments
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam};
    `,
    params,
  );

  return result.rows;
}

async function getAssignmentById(id) {
  const result = await db.query(
    "SELECT * FROM public.assignments WHERE id = $1;",
    [id],
  );
  return result.rows[0] || null;
}

async function createAssignment({
  prompt,
  title = null,
  userId = null,
  subject = null,
  gradeLevel = null,
  detectedTopics = [],
  difficulty = null,
  status = "new",
}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("prompt requerido");
  }

  const result = await db.query(
    `
    INSERT INTO public.assignments
      (user_id, title, prompt, subject, grade_level, detected_topics, difficulty, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
    `,
    [userId, title, prompt, subject, gradeLevel, detectedTopics, difficulty, status],
  );

  return result.rows[0];
}

async function analyzeAssignment({
  assignmentId = null,
  prompt = null,
  title = null,
  userId = null,
  gradeLevel = null,
}) {
  let assignment = null;
  let assignmentPrompt = prompt;
  let assignmentTitle = title;
  let assignmentGradeLevel = gradeLevel;

  if (assignmentId) {
    assignment = await getAssignmentById(assignmentId);
    if (!assignment) throw new Error("assignmentId no encontrado");
    assignmentPrompt = assignment.prompt;
    assignmentTitle = assignment.title;
    assignmentGradeLevel = assignment.grade_level;
  }

  if (!assignmentPrompt || !assignmentPrompt.trim()) {
    throw new Error("prompt o assignmentId requerido");
  }

  const analysis = await generateJson({
    systemPrompt: `
Eres Kibo, un tutor virtual educativo. Analiza tareas escolares y responde unicamente JSON valido.
No uses markdown. No agregues texto fuera del JSON.
`.trim(),
    userPrompt: `
Analiza esta tarea y devuelve este objeto:
{
  "title": "titulo corto",
  "subject": "materia principal",
  "gradeLevel": "nivel estimado",
  "detectedTopics": ["tema 1", "tema 2"],
  "difficulty": "baja|media|alta",
  "recommendedApproach": "plan breve para resolverla",
  "searchQueries": ["consulta para buscar recursos publicos"]
}

Nivel indicado por usuario: ${assignmentGradeLevel || "no indicado"}
Titulo indicado por usuario: ${assignmentTitle || "no indicado"}
Tarea:
"""
${assignmentPrompt}
"""
`.trim(),
  });

  let result;
  if (assignment) {
    result = await db.query(
      `
      UPDATE public.assignments
      SET title = COALESCE($1, title),
          subject = $2,
          grade_level = COALESCE($3, grade_level),
          detected_topics = $4,
          difficulty = $5,
          status = 'analyzed',
          updated_at = NOW()
      WHERE id = $6
      RETURNING *;
      `,
      [
        analysis.title,
        analysis.subject || null,
        analysis.gradeLevel,
        analysis.detectedTopics || [],
        analysis.difficulty || null,
        assignment.id,
      ],
    );
  } else {
    result = await db.query(
      `
      INSERT INTO public.assignments
        (user_id, title, prompt, subject, grade_level, detected_topics, difficulty, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'analyzed')
      RETURNING *;
      `,
      [
        userId,
        analysis.title || assignmentTitle,
        assignmentPrompt,
        analysis.subject || null,
        analysis.gradeLevel || assignmentGradeLevel,
        analysis.detectedTopics || [],
        analysis.difficulty || null,
      ],
    );
  }

  return {
    assignment: result.rows[0],
    analysis,
  };
}

async function recommendResourcesForAssignment({
  assignmentId,
  limit = 5,
  maxScore = 0.5,
}) {
  if (!assignmentId) throw new Error("assignmentId requerido");

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw new Error("assignmentId no encontrado");

  const searchText = [
    assignment.title,
    assignment.subject,
    assignment.grade_level,
    ...(assignment.detected_topics || []),
    assignment.prompt,
  ]
    .filter(Boolean)
    .join("\n");

  // Embedding fuera de la transaccion (llamada externa a Gemini).
  const embedding = await getEmbedding(searchText, { role: "query" });
  const relevant = (await searchRelevantChunks(embedding, limit)).filter(
    (chunk) => Number(chunk.score) <= maxScore,
  );

  // Persistencia transaccional: borra y reinserta atomicamente.
  return db.withTransaction(async (client) => {
    await client.query(
      "DELETE FROM public.assignment_recommendations WHERE assignment_id = $1",
      [assignment.id],
    );

    const recommendations = [];
    for (const chunk of relevant) {
      const source = formatChunkSource(chunk);
      const reason = buildRecommendationReason(assignment, source);

      const result = await client.query(
        `
        INSERT INTO public.assignment_recommendations
          (assignment_id, resource_id, chunk_id, reason, relevance_score)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [assignment.id, source.resourceId, source.chunkId, reason, source.score],
      );

      recommendations.push({
        recommendation: result.rows[0],
        source,
      });
    }

    return { assignment, recommendations };
  });
}

function buildRecommendationReason(assignment, source) {
  const topic =
    assignment.detected_topics?.[0] || assignment.subject || "la tarea";
  const page = source.pageNumber ? `, pagina ${source.pageNumber}` : "";
  const title = source.resourceTitle || "este recurso";
  return `Kibo recomienda ${title}${page} porque contiene informacion relacionada con ${topic}.`;
}

async function summarizeText({
  text,
  summaryType = "general",
  userId = null,
  resourceId = null,
  documentId = null,
}) {
  if (!text || !text.trim()) throw new Error("text requerido");

  const content = await generateText({
    systemPrompt: `
Eres Kibo, un tutor virtual educativo. Resume material educativo en espanol neutral.
Adapta el resumen al tipo solicitado y evita inventar datos.
`.trim(),
    userPrompt: `
Tipo de resumen: ${summaryType}

Texto:
"""
${text}
"""
`.trim(),
    maxOutputTokens: 900,
  });

  const result = await db.query(
    `
    INSERT INTO public.summaries
      (resource_id, document_id, user_id, summary_type, content)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
    `,
    [resourceId, documentId, userId, summaryType, content],
  );

  return result.rows[0];
}

async function createQuiz({
  topic,
  text = null,
  subject = null,
  questionCount = 5,
  userId = null,
  assignmentId = null,
  resourceId = null,
}) {
  if (!topic && !text) throw new Error("topic o text requerido");

  const quiz = await generateJson({
    systemPrompt: `
Eres Kibo, un tutor virtual educativo. Genera preguntas de practica tipo examen.
Responde unicamente JSON valido. No uses markdown.
`.trim(),
    userPrompt: `
Genera un quiz con ${questionCount} preguntas.
Devuelve:
{
  "title": "titulo del quiz",
  "subject": "materia",
  "topic": "tema",
  "questions": [
    {
      "question": "pregunta",
      "questionType": "multiple_choice|open|true_false",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "respuesta correcta",
      "explanation": "explicacion breve"
    }
  ]
}

Materia: ${subject || "no indicada"}
Tema: ${topic || "inferir del texto"}
Texto base:
"""
${text || ""}
"""
`.trim(),
    maxOutputTokens: 1600,
  });

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  return db.withTransaction(async (client) => {
    const quizResult = await client.query(
      `
      INSERT INTO public.quizzes
        (user_id, assignment_id, resource_id, title, subject, topic)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [
        userId,
        assignmentId,
        resourceId,
        quiz.title || `Quiz de ${topic || "practica"}`,
        quiz.subject || subject,
        quiz.topic || topic,
      ],
    );

    const savedQuiz = quizResult.rows[0];
    const savedQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionResult = await client.query(
        `
        INSERT INTO public.quiz_questions
          (quiz_id, question, question_type, options, correct_answer, explanation, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        [
          savedQuiz.id,
          q.question,
          normalizeQuestionType(q.questionType),
          JSON.stringify(q.options || []),
          q.correctAnswer || null,
          q.explanation || null,
          i,
        ],
      );
      savedQuestions.push(questionResult.rows[0]);
    }

    return { quiz: savedQuiz, questions: savedQuestions };
  });
}

// ─── POR resourceId: contenido + resumen + quiz + pack de estudio ──────────

const STUDY_MAX_CHARS = Number(process.env.STUDY_MAX_CHARS || 80_000);

/**
 * Trae el recurso con su texto completo (ultimo documento).
 */
async function getResourceWithContent(resourceId) {
  const result = await db.query(
    `
    SELECT r.id, r.title, r.subject, r.grade_level, r.resource_type, r.metadata,
           d.id AS document_id, d.raw_content
    FROM public.resources r
    LEFT JOIN public.documents d ON d.resource_id = r.id
    WHERE r.id = $1
    ORDER BY d.created_at DESC NULLS LAST
    LIMIT 1;
    `,
    [resourceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return row;
}

function truncateSmart(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  // Mantenemos el inicio y el final para cubrir intro y conclusiones.
  const headSize = Math.floor(maxChars * 0.7);
  const tailSize = maxChars - headSize - 200;
  return (
    text.slice(0, headSize) +
    "\n\n[...texto truncado por tamano...]\n\n" +
    text.slice(-tailSize)
  );
}

/**
 * Genera (y guarda) un resumen de un recurso existente usando su texto.
 */
async function summarizeResource({
  resourceId,
  summaryType = "study_guide",
  userId = null,
  maxChars = STUDY_MAX_CHARS,
}) {
  const resource = await getResourceWithContent(resourceId);
  if (!resource) throw new Error("resourceId no encontrado");
  if (!resource.raw_content) {
    throw new Error("El recurso no tiene contenido para resumir");
  }

  const text = truncateSmart(resource.raw_content, maxChars);
  return summarizeText({
    text,
    summaryType,
    userId,
    resourceId: resource.id,
    documentId: resource.document_id,
  });
}

/**
 * Genera (y guarda) un quiz basado en el contenido de un recurso existente.
 */
async function createQuizFromResource({
  resourceId,
  questionCount = 5,
  userId = null,
  assignmentId = null,
  maxChars = STUDY_MAX_CHARS,
}) {
  const resource = await getResourceWithContent(resourceId);
  if (!resource) throw new Error("resourceId no encontrado");
  if (!resource.raw_content) {
    throw new Error("El recurso no tiene contenido para generar quiz");
  }

  const text = truncateSmart(resource.raw_content, maxChars);
  return createQuiz({
    topic: resource.title,
    subject: resource.subject,
    text,
    questionCount,
    userId,
    assignmentId,
    resourceId: resource.id,
  });
}

/**
 * "Study pack": en una sola llamada al LLM produce resumen + quiz +
 * conceptos clave + temario sugerido, y lo guarda en DB.
 * Ahorra cuota vs llamar 3 endpoints por separado.
 */
async function generateStudyPack({
  resourceId,
  questionCount = 5,
  summaryType = "study_guide",
  userId = null,
  maxChars = STUDY_MAX_CHARS,
  onProgress = () => {},
}) {
  const resource = await getResourceWithContent(resourceId);
  if (!resource) throw new Error("resourceId no encontrado");
  if (!resource.raw_content) {
    throw new Error("El recurso no tiene contenido");
  }

  const text = truncateSmart(resource.raw_content, maxChars);

  onProgress({ stage: "study_llm_start", chars: text.length });

  const pack = await generateJson({
    systemPrompt: `
Eres Kibo, un tutor virtual. Analiza material educativo y devuelve UNICAMENTE
un JSON valido (sin markdown, sin texto extra).
Responde en espanol neutral. No inventes datos.
`.trim(),
    userPrompt: `
A partir de este material educativo, devuelve:

{
  "summary": "resumen tipo ${summaryType} (5-10 parrafos)",
  "keyConcepts": [
    { "term": "concepto 1", "definition": "definicion breve" }
  ],
  "outline": ["punto 1", "punto 2"],
  "quiz": {
    "title": "titulo breve del quiz",
    "subject": "materia",
    "topic": "tema principal",
    "questions": [
      {
        "question": "texto de la pregunta",
        "questionType": "multiple_choice",
        "options": ["A","B","C","D"],
        "correctAnswer": "la opcion correcta, tal cual aparece en options",
        "explanation": "por que es la correcta, breve"
      }
    ]
  }
}

Genera ${questionCount} preguntas en el quiz, variando dificultad.
Materia del recurso: ${resource.subject || "no indicada"}
Titulo del recurso: ${resource.title || "(sin titulo)"}

Texto:
"""
${text}
"""
`.trim(),
    temperature: 0.3,
    maxOutputTokens: 2400,
  });

  onProgress({ stage: "study_llm_done" });

  // Persistimos summary + quiz (los conceptos y outline van en el response,
  // no tienen tabla propia por simplicidad).
  const savedSummary = await db.query(
    `
    INSERT INTO public.summaries
      (resource_id, document_id, user_id, summary_type, content)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
    `,
    [
      resource.id,
      resource.document_id,
      userId,
      summaryType,
      pack.summary || "",
    ],
  );

  const questions = Array.isArray(pack.quiz?.questions) ? pack.quiz.questions : [];
  const savedQuiz = await db.withTransaction(async (client) => {
    const q = pack.quiz || {};
    const quizResult = await client.query(
      `
      INSERT INTO public.quizzes
        (user_id, assignment_id, resource_id, title, subject, topic)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [
        userId,
        null,
        resource.id,
        q.title || `Quiz de ${resource.title || "practica"}`,
        q.subject || resource.subject,
        q.topic || resource.title,
      ],
    );
    const quiz = quizResult.rows[0];

    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const qq = questions[i];
      const r = await client.query(
        `
        INSERT INTO public.quiz_questions
          (quiz_id, question, question_type, options, correct_answer, explanation, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        [
          quiz.id,
          qq.question,
          normalizeQuestionType(qq.questionType),
          JSON.stringify(qq.options || []),
          qq.correctAnswer || null,
          qq.explanation || null,
          i,
        ],
      );
      savedQuestions.push(r.rows[0]);
    }

    return { quiz, questions: savedQuestions };
  });

  return {
    resource: {
      id: resource.id,
      title: resource.title,
      subject: resource.subject,
      gradeLevel: resource.grade_level,
    },
    summary: savedSummary.rows[0],
    keyConcepts: Array.isArray(pack.keyConcepts) ? pack.keyConcepts : [],
    outline: Array.isArray(pack.outline) ? pack.outline : [],
    quiz: savedQuiz,
  };
}

module.exports = {
  analyzeAssignment,
  createAssignment,
  createQuiz,
  createQuizFromResource,
  generateStudyPack,
  getAssignmentById,
  listAssignments,
  recommendResourcesForAssignment,
  summarizeResource,
  summarizeText,
};
