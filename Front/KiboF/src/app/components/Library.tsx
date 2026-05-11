import { useState } from 'react';
import { BookOpen, ExternalLink, Search, Library as LibraryIcon } from 'lucide-react';

const mockLibraryBooks = [
  {
    id: 1,
    title: 'React Patterns',
    author: 'Michael Chan',
    cover: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Frontend',
  },
  {
    id: 2,
    title: 'TypeScript Deep Dive',
    author: 'Basarat Ali Syed',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Frontend',
  },
  {
    id: 3,
    title: 'Clean Code',
    author: 'Robert C. Martin',
    cover: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Programming',
  },
  {
    id: 4,
    title: 'JavaScript: The Good Parts',
    author: 'Douglas Crockford',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Frontend',
  },
  {
    id: 5,
    title: 'Design Patterns',
    author: 'Gang of Four',
    cover: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Programming',
  },
  {
    id: 6,
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Career',
  },
  {
    id: 7,
    title: 'You Don\'t Know JS',
    author: 'Kyle Simpson',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Frontend',
  },
  {
    id: 8,
    title: 'Refactoring',
    author: 'Martin Fowler',
    cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=600&fit=crop',
    pdfLink: '#',
    category: 'Programming',
  },
];

export function Library() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(mockLibraryBooks.map(book => book.category)))];

  const filteredBooks = mockLibraryBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-foreground mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <LibraryIcon className="w-6 h-6 text-white" />
            </div>
            Biblioteca Digital
          </h1>
          <p className="text-muted-foreground">
            Explora nuestra colección de libros y recursos
          </p>
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título o autor..."
              className="w-full pl-12 pr-4 py-3 bg-card rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl transition-all font-medium ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'bg-secondary text-foreground hover:bg-muted hover:shadow-sm'
                }`}
              >
                {category === 'all' ? 'Todos' : category}
              </button>
            ))}
          </div>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="bg-card rounded-3xl shadow-xl border border-border p-12 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-foreground mb-2">No se encontraron libros</h2>
            <p className="text-muted-foreground">
              Intenta con otra búsqueda o categoría
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((book) => (
              <a
                key={book.id}
                href={book.pdfLink}
                className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 group"
              >
                <div className="aspect-[2/3] overflow-hidden bg-muted">
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-foreground group-hover:text-primary transition-colors mb-1">
                    {book.title}
                  </h3>
                  <p className="text-muted-foreground mb-2">{book.author}</p>
                  <span className="inline-block px-2 py-1 bg-secondary text-foreground rounded text-sm">
                    {book.category}
                  </span>
                  <div className="flex items-center gap-2 mt-3 text-primary">
                    <ExternalLink className="w-4 h-4" />
                    <span>Ver PDF</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
