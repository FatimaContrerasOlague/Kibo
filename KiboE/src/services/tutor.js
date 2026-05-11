const db = require("../db");
const { getEmbedding } = require("./embeddings");
const { generateJson, generateText } = require("./ai");
const { formatChunkSource, searchRelevantChunks } = require("./search");

const allowedQuestionTypes = new Set(["multiple_choice", "open", "true_false"]);

function normalizeQuestionType(type) {
  return allowedQuestionTypes.has(type) ? type : "multiple_choice";
}

async function listAssignments({ userId = null, status = null, limit = 50 } = {}) {
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

  params.push(limit);
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await db.query(
    `
    SELECT *
    FROM public.assignments
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length};
  `,
    params,
  );

  return result.rows;
}

async function getAssignmentById(id) {
  const result = await db.query(
    `
    SELECT *
    FROM public.assignments
    WHERE id = $1;
  `,
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
    [
      userId,
      title,
      prompt,
      subject,
      gradeLevel,
      detectedTopics,
      difficulty,
      status,
    ],
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
    if (!assignment) {
      throw new Error("assignmentId no encontrado");
    }

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

async function recommendResourcesForAssignment({ assignmentId, limit = 5, maxScore = 0.5 }) {
  if (!assignmentId) {
    throw new Error("assignmentId requerido");
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error("assignmentId no encontrado");
  }

  const searchText = [
    assignment.title,
    assignment.subject,
    assignment.grade_level,
    ...(assignment.detected_topics || []),
    assignment.prompt,
  ]
    .filter(Boolean)
    .join("\n");

  const embedding = await getEmbedding(searchText);
  const chunks = (await searchRelevantChunks(embedding, limit)).filter(
    (chunk) => Number(chunk.score) <= maxScore,
  );

  await db.query(
    "DELETE FROM public.assignment_recommendations WHERE assignment_id = $1",
    [assignment.id],
  );

  const recommendations = [];

  for (const chunk of chunks) {
    const source = formatChunkSource(chunk);
    const reason = buildRecommendationReason(assignment, source);

    const result = await db.query(
      `
      INSERT INTO public.assignment_recommendations
        (assignment_id, resource_id, chunk_id, reason, relevance_score)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `,
      [
        assignment.id,
        source.resourceId,
        source.chunkId,
        reason,
        source.score,
      ],
    );

    recommendations.push({
      recommendation: result.rows[0],
      source,
    });
  }

  return {
    assignment,
    recommendations,
  };
}

function buildRecommendationReason(assignment, source) {
  const topic = assignment.detected_topics?.[0] || assignment.subject || "la tarea";
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
  if (!text || !text.trim()) {
    throw new Error("text requerido");
  }

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
  if (!topic && !text) {
    throw new Error("topic o text requerido");
  }

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

  const quizResult = await db.query(
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
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const savedQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionResult = await db.query(
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

  return {
    quiz: savedQuiz,
    questions: savedQuestions,
  };
}

module.exports = {
  analyzeAssignment,
  createAssignment,
  createQuiz,
  getAssignmentById,
  listAssignments,
  recommendResourcesForAssignment,
  summarizeText,
};
