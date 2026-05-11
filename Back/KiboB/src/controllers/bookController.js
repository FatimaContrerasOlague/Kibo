const { searchBooks } = require("../services/bookService");

async function search(req, res, next) {
  try {
    const q = req.query.q || "productividad";
    const limit = Number(req.query.limit || 12);
    const books = await searchBooks({ query: q, limit });
    res.json({ query: q, books });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  search,
};
