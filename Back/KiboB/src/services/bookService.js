const { openLibraryBaseUrl } = require("../config/env");

function normalizeBook(doc) {
  const coverId = doc.cover_i;
  const cover = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
    : "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80";

  return {
    id: doc.key || doc.cover_edition_key || doc.edition_key?.[0] || doc.title,
    title: doc.title || "Sin titulo",
    author: Array.isArray(doc.author_name) ? doc.author_name[0] : "Autor desconocido",
    cover,
    pdfLink: Array.isArray(doc.ia)
      ? `https://archive.org/details/${doc.ia[0]}`
      : `https://openlibrary.org${doc.key}`,
    topics: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
  };
}

async function searchBooks({ query, limit = 12 }) {
  const safeQuery = encodeURIComponent(query || "productividad");
  const url = `${openLibraryBaseUrl}/search.json?q=${safeQuery}&limit=${Math.max(1, Math.min(limit, 30))}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library error: ${response.status}`);
  }

  const payload = await response.json();
  const docs = Array.isArray(payload.docs) ? payload.docs : [];
  return docs.slice(0, limit).map(normalizeBook);
}

function calculateBestDay(dueAtIso) {
  if (!dueAtIso) {
    return "Hoy";
  }

  const due = new Date(dueAtIso);
  if (Number.isNaN(due.getTime())) {
    return "Hoy";
  }

  const recommended = new Date(due.getTime() - 24 * 60 * 60 * 1000);
  return recommended.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function keywordFromTask(taskTitle) {
  if (!taskTitle || typeof taskTitle !== "string") {
    return "productividad";
  }
  const cleaned = taskTitle
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  return cleaned || "productividad";
}

module.exports = {
  searchBooks,
  calculateBestDay,
  keywordFromTask,
};
