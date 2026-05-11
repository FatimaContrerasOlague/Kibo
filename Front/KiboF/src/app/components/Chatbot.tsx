import { useState, useRef } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { Send, Paperclip, Sparkles, Bell, X } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';
import { NotificationPanel } from './NotificationPanel';
import { motion, AnimatePresence } from 'motion/react';
import { apiRequest } from '../services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! Soy Kibo, tu asistente personal. Estoy aquí para ayudarte con tus tareas, recordatorios y recomendaciones. ¿En qué puedo ayudarte hoy?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tasks } = useTasks();
  const { user } = useAuth();

  const handleSendMessage = async () => {
    if (!input.trim() || !user?.id || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const payload = await apiRequest<{ conversation: Array<{ id: string; role: 'user' | 'assistant'; message: string; createdAt: string }> }>('/chatbot/chat', {
        method: 'POST',
        body: {
          userId: user.id,
          message: userMessage.text,
        },
      });

      const bot = payload.conversation.find((msg) => msg.role === 'assistant');
      if (bot) {
        setMessages((prev) => [
          ...prev,
          {
            id: bot.id,
            text: bot.message,
            sender: 'bot',
            timestamp: new Date(bot.createdAt),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'No pude conectar con el servicio de chatbot. Intenta nuevamente en unos segundos.',
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) {
      return;
    }

    const content = await file.text();

    try {
      await apiRequest<{ file: { id: string } }>('/chatbot/files', {
        method: 'POST',
        body: {
          userId: user.id,
          fileName: file.name,
          content,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `file-${Date.now()}`,
          text: `Archivo "${file.name}" subido correctamente. Ya puedes consultarme sobre su contenido.`,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `file-error-${Date.now()}`,
          text: `No pude subir el archivo "${file.name}". Intenta nuevamente.`,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } finally {
      event.target.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="h-[calc(100vh-64px)] flex relative">
        <div className="flex-1 flex flex-col bg-background/50 backdrop-blur-sm">
          <div className="p-4 md:p-6 border-b border-border bg-card shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-foreground text-lg md:text-xl">Asistente Kibo</h1>
                  <p className="text-muted-foreground text-sm hidden md:block">Siempre listo para ayudarte</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="lg:hidden p-2 bg-secondary rounded-xl hover:bg-muted transition-colors relative"
              >
                <Bell className="w-5 h-5 text-foreground" />
                {tasks.filter(t => !t.completed).length > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{tasks.filter(t => !t.completed).length}</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 md:gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'bot' && (
                  <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
                    <ElephantMascot size="small" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] md:max-w-md px-3 md:px-4 py-2 md:py-3 rounded-2xl shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-primary to-accent text-white'
                      : 'bg-secondary text-foreground border border-border'
                  }`}
                >
                  <p className="whitespace-pre-line text-sm md:text-base">{message.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="p-4 md:p-6 border-t border-border bg-card shadow-lg">
            <div className="flex gap-2 md:gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 md:p-3 bg-secondary rounded-xl hover:bg-muted transition-colors shadow-sm hidden md:block"
              >
                <Paperclip className="w-5 h-5 text-foreground" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring shadow-sm text-sm md:text-base"
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending}
                className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">{isSending ? 'Enviando...' : 'Enviar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Panel de notificaciones desktop */}
        <div className="hidden lg:block">
          <NotificationPanel />
        </div>

        {/* Panel de notificaciones móvil (modal) */}
        <AnimatePresence>
          {showNotifications && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowNotifications(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 lg:hidden"
              >
                <div className="h-full bg-card flex flex-col">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-foreground font-bold">Notificaciones</h2>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <NotificationPanel isMobile />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
