import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Clock, AlertCircle, BookOpen, ExternalLink } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';
import { motion, AnimatePresence } from 'motion/react';
import { apiRequest } from '../services/api';

interface BackendNotification {
  taskId: string;
  taskTitle: string;
  dueAt: string;
  reminders: Array<{
    key: string;
    label: string;
    shouldNotify: boolean;
    millisUntilReminder: number;
  }>;
  recommendation: {
    id: string;
    title: string;
    cover: string;
    pdfLink: string;
  } | null;
}

interface NotificationPanelProps {
  isMobile?: boolean;
}

export function NotificationPanel({ isMobile = false }: NotificationPanelProps) {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const [backendNotifications, setBackendNotifications] = useState<BackendNotification[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (!user?.id) {
        setBackendNotifications([]);
        return;
      }

      try {
        const payload = await apiRequest<{ notifications: BackendNotification[] }>(
          `/notifications/${encodeURIComponent(user.id)}`
        );

        if (!isMounted) {
          return;
        }

        setBackendNotifications(payload.notifications || []);
      } catch {
        if (isMounted) {
          setBackendNotifications([]);
        }
      }
    };

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [tasks, user?.id]);

  const notifications = useMemo(
    () =>
      backendNotifications.map((item) => {
        const reminder = item.reminders[0];
        const urgency: 'high' | 'medium' = reminder?.key === '1h' || reminder?.key === '4h' ? 'high' : 'medium';

        return {
          id: `${item.taskId}-${reminder?.key || 'due'}`,
          task: {
            title: item.taskTitle,
            dueDate: new Date(item.dueAt),
          },
          urgency,
          message: reminder
            ? `Recordatorio ${reminder.label}: prioriza esta tarea ahora.`
            : 'Tienes una tarea próxima a vencer.',
          recommendedBook: item.recommendation,
        };
      }),
    [backendNotifications]
  );

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
                  <div className="flex gap-3 mb-3 items-start">
                    <div className="flex-shrink-0">
                      <ElephantMascot size="small" animate={notification.urgency === 'high'} />
                    </div>
                    <div className="flex-1">
                      <div className={`relative rounded-2xl border px-3 py-2 mb-2 ${
                        notification.urgency === 'high'
                          ? 'bg-destructive/5 border-destructive/30'
                          : 'bg-card border-border'
                      }`}>
                        <div className={`absolute -left-1 top-4 w-2.5 h-2.5 rotate-45 border-l border-b ${
                          notification.urgency === 'high'
                            ? 'bg-destructive/5 border-destructive/30'
                            : 'bg-card border-border'
                        }`} />
                        <p className="text-muted-foreground text-sm">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 mb-1">
                        {notification.urgency === 'high' ? (
                          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        )}
                        <h4 className="text-foreground font-medium">{notification.task.title}</h4>
                      </div>
                      <p className="text-primary text-sm font-medium">
                        {format(notification.task.dueDate, "HH:mm '·' d MMM", { locale: es })}
                      </p>
                    </div>
                  </div>
                </div>

                {notification.recommendedBook && (
                <div className="p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h5 className="text-foreground font-medium text-sm">Libro recomendado</h5>
                  </div>
                  <a
                    href={notification.recommendedBook.pdfLink}
                    target="_blank"
                    rel="noreferrer"
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
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
