import { useTasks } from '../contexts/TaskContext';
import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen, ExternalLink, Calendar, Lightbulb } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';
import { apiRequest } from '../services/api';

interface RecommendedBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  pdfLink: string;
}

interface TaskRecommendation {
  bestDay: string;
  recommendations: RecommendedBook[];
}

export function Recommendations() {
  const { tasks } = useTasks();
  const incompleteTasks = tasks.filter(task => !task.completed);
  const [recommendationByTask, setRecommendationByTask] = useState<Record<string, TaskRecommendation>>({});

  useEffect(() => {
    let isMounted = true;

    const loadRecommendations = async () => {
      const entries = await Promise.all(
        incompleteTasks.map(async (task) => {
          try {
            const payload = await apiRequest<TaskRecommendation>(
              `/recommendations?taskId=${encodeURIComponent(task.id)}&limit=2`
            );
            return [task.id, payload] as const;
          } catch {
            return [
              task.id,
              {
                bestDay: 'Hoy',
                recommendations: [],
              },
            ] as const;
          }
        })
      );

      if (!isMounted) {
        return;
      }

      setRecommendationByTask(Object.fromEntries(entries));
    };

    void loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [incompleteTasks]);

  const getRecommendedDay = (dueDate: Date) => {
    const daysUntilDue = differenceInDays(dueDate, new Date());
    const recommendedDate = new Date();
    recommendedDate.setDate(recommendedDate.getDate() + Math.max(0, Math.floor(daysUntilDue / 2)));
    return recommendedDate;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-foreground mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            Recomendaciones Personalizadas
          </h1>
          <p className="text-muted-foreground">
            Libros sugeridos y días recomendados para cada tarea
          </p>
        </div>

        {incompleteTasks.length === 0 ? (
          <div className="bg-card rounded-3xl shadow-xl border border-border p-12 text-center">
            <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-foreground mb-2">No hay tareas pendientes</h2>
            <p className="text-muted-foreground">
              Agrega tareas en el calendario para recibir recomendaciones personalizadas
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {incompleteTasks.map((task) => {
              const taskRecommendation = recommendationByTask[task.id];
              const recommendedBooks = taskRecommendation?.recommendations || [];
              const recommendedDay = taskRecommendation?.bestDay || format(getRecommendedDay(task.dueDate), "EEEE d 'de' MMMM", { locale: es });

              return (
                <div
                  key={task.id}
                  className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-primary to-accent p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                      <ElephantMascot size="large" animate={false} />
                    </div>
                    <h2 className="text-white mb-2">{task.title}</h2>
                    <p className="text-white/90">{task.description}</p>
                    <div className="flex items-center gap-2 mt-3 text-white/90">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Vence: {format(task.dueDate, "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-accent" />
                        <h3 className="text-foreground">Día recomendado para realizar</h3>
                      </div>
                      <div className="bg-secondary rounded-lg p-4 border border-border">
                        <p className="text-primary">
                          {recommendedDay}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          Te sugerimos completar esta tarea en esta fecha para mantener un ritmo óptimo
                        </p>
                      </div>
                    </div>

                    {recommendedBooks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <BookOpen className="w-5 h-5 text-accent" />
                          <h3 className="text-foreground">Libros recomendados</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {recommendedBooks.map((book) => (
                            <a
                              key={book.id}
                              href={book.pdfLink}
                              className="flex gap-4 bg-input-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow group"
                            >
                              <img
                                src={book.cover}
                                alt={book.title}
                                className="w-20 h-28 object-cover rounded-lg"
                              />
                              <div className="flex-1">
                                <h4 className="text-foreground group-hover:text-primary transition-colors">
                                  {book.title}
                                </h4>
                                <p className="text-muted-foreground mt-1">{book.author}</p>
                                <div className="flex items-center gap-2 mt-3 text-primary">
                                  <ExternalLink className="w-4 h-4" />
                                  <span>Ver PDF</span>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
