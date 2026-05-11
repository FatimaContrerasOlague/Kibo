import { useTasks } from '../contexts/TaskContext';
import { differenceInHours, differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Clock, AlertCircle, BookOpen, ExternalLink } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';
import { motion, AnimatePresence } from 'motion/react';

const mockBooks = [
  {
    id: 1,
    title: 'React Patterns',
    cover: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=200&h=300&fit=crop',
    pdfLink: '#',
    topics: ['react', 'hooks', 'patterns'],
  },
  {
    id: 2,
    title: 'TypeScript Deep Dive',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=300&fit=crop',
    pdfLink: '#',
    topics: ['typescript', 'types', 'advanced'],
  },
];

interface NotificationPanelProps {
  isMobile?: boolean;
}

export function NotificationPanel({ isMobile = false }: NotificationPanelProps) {
  const { tasks } = useTasks();
  const now = new Date();

  const getRecommendedBook = (taskTitle: string) => {
    const titleLower = taskTitle.toLowerCase();
    const book = mockBooks.find(book =>
      book.topics.some(topic => titleLower.includes(topic))
    );
    return book || mockBooks[0];
  };

  const getNotifications = () => {
    const notifications: Array<{
      id: string;
      task: typeof tasks[0];
      urgency: 'high' | 'medium' | 'low';
      message: string;
      hoursLeft: number;
      recommendedBook: typeof mockBooks[0];
    }> = [];

    tasks.forEach(task => {
      if (task.completed) return;

      const hoursLeft = differenceInHours(task.dueDate, now);
      const daysLeft = differenceInDays(task.dueDate, now);

      if (hoursLeft <= 1 && hoursLeft > 0) {
        notifications.push({
          id: `${task.id}-1h`,
          task,
          urgency: 'high',
          message: '¡Solo queda 1 hora! Es momento de enfocarte en esta tarea.',
          hoursLeft,
          recommendedBook: getRecommendedBook(task.title),
        });
      } else if (hoursLeft <= 4 && hoursLeft > 1) {
        notifications.push({
          id: `${task.id}-4h`,
          task,
          urgency: 'high',
          message: 'Quedan 4 horas. ¡No lo dejes para el último momento!',
          hoursLeft,
          recommendedBook: getRecommendedBook(task.title),
        });
      } else if (hoursLeft <= 8 && hoursLeft > 4) {
        notifications.push({
          id: `${task.id}-8h`,
          task,
          urgency: 'medium',
          message: 'Quedan 8 horas. Considera empezar pronto.',
          hoursLeft,
          recommendedBook: getRecommendedBook(task.title),
        });
      } else if (daysLeft === 1) {
        notifications.push({
          id: `${task.id}-1d`,
          task,
          urgency: 'medium',
          message: 'Vence mañana. ¡Planifica tu tiempo!',
          hoursLeft,
          recommendedBook: getRecommendedBook(task.title),
        });
      }
    });

    return notifications.sort((a, b) => a.hoursLeft - b.hoursLeft);
  };

  const notifications = getNotifications();

  return (
    <div className={`bg-card flex flex-col shadow-2xl h-full ${isMobile ? '' : 'w-96 border-l border-border'}`}>
      {!isMobile && (
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-foreground">Notificaciones</h2>
            <p className="text-muted-foreground">
              {notifications.length} {notifications.length === 1 ? 'recordatorio' : 'recordatorios'}
            </p>
          </div>
        </div>
      </div>
      )}

      <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-4' : 'p-4'}`}>
        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="flex justify-center mb-4">
                <ElephantMascot size="large" />
              </div>
              <p className="text-muted-foreground">
                ¡Todo bajo control! No hay recordatorios urgentes.
              </p>
            </motion.div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-2xl border shadow-lg overflow-hidden ${
                  notification.urgency === 'high'
                    ? 'bg-destructive/5 border-destructive/30'
                    : 'bg-secondary border-border'
                }`}
              >
                <div className={`p-4 ${notification.urgency === 'high' ? 'bg-destructive/10' : 'bg-primary/5'}`}>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <ElephantMascot size="small" animate={notification.urgency === 'high'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2 mb-2">
                        {notification.urgency === 'high' ? (
                          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        )}
                        <h4 className="text-foreground font-medium">{notification.task.title}</h4>
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">
                        {notification.message}
                      </p>
                      <p className="text-primary text-sm font-medium">
                        {format(notification.task.dueDate, "HH:mm '·' d MMM", { locale: es })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h5 className="text-foreground font-medium text-sm">Libro recomendado</h5>
                  </div>
                  <a
                    href={notification.recommendedBook.pdfLink}
                    className="flex gap-3 bg-secondary rounded-xl p-3 hover:shadow-md transition-shadow group"
                  >
                    <img
                      src={notification.recommendedBook.cover}
                      alt={notification.recommendedBook.title}
                      className="w-12 h-16 object-cover rounded-lg shadow-sm"
                    />
                    <div className="flex-1">
                      <h6 className="text-foreground text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                        {notification.recommendedBook.title}
                      </h6>
                      <div className="flex items-center gap-1 mt-2 text-primary text-xs">
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver PDF</span>
                      </div>
                    </div>
                  </a>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
