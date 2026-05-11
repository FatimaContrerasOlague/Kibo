import { useState } from 'react';
import { useTasks, Task } from '../contexts/TaskContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2, Calendar as CalendarIcon, Sparkles, X, Info, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', time: '12:00' });
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleAddTask = async () => {
    if (!selectedDate || !newTask.title) return;
    const [hours, minutes] = newTask.time.split(':').map(Number);
    const dueDate = new Date(selectedDate);
    dueDate.setHours(hours, minutes);
    await addTask({ title: newTask.title, description: newTask.description, dueDate });
    setNewTask({ title: '', description: '', time: '12:00' });
  };

  const tasksForSelectedDate = selectedDate
    ? tasks.filter(task => isSameDay(task.dueDate, selectedDate))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Encabezado */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-foreground flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <CalendarIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <span className="block text-3xl font-bold">Calendario de Tareas</span>
                <span className="block text-muted-foreground text-base mt-1">Organiza y gestiona tus actividades</span>
              </div>
            </h1>
            <div className="flex items-center gap-4 bg-card px-6 py-3 rounded-2xl shadow-lg border border-border">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-secondary rounded-xl transition-all">
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-foreground min-w-[180px] text-center capitalize font-bold text-lg">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </h2>
              <button onClick={handleNextMonth} className="p-2 hover:bg-secondary rounded-xl transition-all">
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Layout principal: flex para garantizar 75/25 en PC */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* COLUMNA IZQUIERDA 75%: Calendario + Tareas pendientes */}
          <div style={{ flex: '3 1 500px', minWidth: 0 }} className="space-y-6">

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-3xl shadow-xl border border-border p-3 md:p-5">

              {/* Cabecera d�as semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b'].map((day) => (
                  <div key={day} className="text-center text-muted-foreground py-1 font-semibold text-xs">{day}</div>
                ))}
              </div>

              {/* D�as */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dayTasks = tasks.filter(task => isSameDay(task.dueDate, day));
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isTodayDate = isToday(day);
                  return (
                    <motion.button
                      key={day.toString()}
                      onClick={() => setSelectedDate(day)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`aspect-square p-1.5 rounded-xl border-2 transition-all relative font-medium text-sm ${
                        isSelected
                          ? 'bg-gradient-to-br from-primary to-accent text-white border-primary shadow-xl'
                          : isTodayDate
                          ? 'bg-primary/10 border-primary text-primary shadow-md'
                          : isCurrentMonth
                          ? 'bg-secondary border-border text-foreground hover:bg-muted hover:border-primary/30'
                          : 'bg-muted/30 border-border/50 text-muted-foreground'
                      }`}
                    >
                      <span className={isSelected || isTodayDate ? 'font-bold' : ''}>{format(day, 'd')}</span>
                      {dayTasks.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayTasks.slice(0, 3).map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`} />
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-accent" />
                  <span className="text-muted-foreground font-medium">Seleccionado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />
                  <span className="text-muted-foreground font-medium">Hoy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <span className="text-muted-foreground font-medium">Con tareas</span>
                </div>
              </div>
            </motion.div>

            {/* Tareas del d�a seleccionado */}
            <AnimatePresence>
              {selectedDate && tasksForSelectedDate.length > 0 && (
                <motion.div
                  key="task-list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-card rounded-3xl shadow-xl border border-border p-6"
                >
                  <h3 className="text-foreground font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Tareas para {format(selectedDate, "d 'de' MMMM", { locale: es })}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tasksForSelectedDate.map((task, index) => (
                      <motion.button
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedTask(task)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all shadow-sm hover:shadow-lg ${
                          task.completed
                            ? 'bg-muted/50 border-border opacity-60'
                            : 'bg-gradient-to-br from-background to-secondary border-primary/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {task.completed
                              ? <CheckCircle2 className="w-5 h-5 text-primary" />
                              : <Circle className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-foreground font-semibold text-sm ${task.completed ? 'line-through' : ''}`}>
                              {task.title}
                            </h4>
                            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{task.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-primary font-medium">
                              <Clock className="w-3 h-3" />
                              <span className="text-xs">{format(task.dueDate, 'HH:mm')}</span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* COLUMNA DERECHA 25%: Nueva Tarea */}
          <div style={{ flex: '1 1 260px', position: 'sticky', top: '6rem', alignSelf: 'flex-start' }}>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-accent p-4 md:p-6">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <h3 className="text-lg font-bold">Nueva Tarea</h3>
                      {selectedDate && (
                        <p className="text-white/90 text-sm mt-1 capitalize">
                          {format(selectedDate, "d 'de' MMMM", { locale: es })}
                        </p>
                      )}
                    </div>
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>
                <div className="p-4 md:p-6">
                  {selectedDate ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Título</label>
                        <input
                          type="text"
                          placeholder="Título de la tarea"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          className="w-full px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Descripción</label>
                        <textarea
                          placeholder="Descripción de la tarea"
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                          className="w-full px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Hora</label>
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <input
                            type="time"
                            value={newTask.time}
                            onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                            className="flex-1 px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => { void handleAddTask(); }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Agregar Tarea
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">Selecciona un día</p>
                      <p className="text-muted-foreground text-sm mt-1">Para agregar una nueva tarea</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Modal detalle de tarea */}
        <AnimatePresence>
          {selectedTask && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setSelectedTask(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedTask(null)}
              >
                <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-md overflow-hidden"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="bg-gradient-to-r from-primary to-accent p-6">
                    <div className="flex items-start justify-between text-white">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">{selectedTask.title}</h2>
                        <div className="flex items-center gap-2 text-white/90">
                          <CalendarIcon className="w-4 h-4" />
                          <span className="text-sm capitalize">
                            {format(selectedTask.dueDate, "EEEE, d 'de' MMMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Descripción</h3>
                      </div>
                      <p className="text-muted-foreground bg-secondary p-4 rounded-xl">
                        {selectedTask.description || 'Sin descripción'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Hora de entrega</h3>
                      </div>
                      <p className="text-foreground bg-secondary p-4 rounded-xl font-medium">
                        {format(selectedTask.dueDate, 'HH:mm')}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        {selectedTask.completed
                          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                          : <Circle className="w-5 h-5 text-muted-foreground" />}
                        <h3 className="font-semibold text-foreground">Estado</h3>
                      </div>
                      <div className={`p-4 rounded-xl border-2 ${selectedTask.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary border-border'}`}>
                        <p className={`font-medium ${selectedTask.completed ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {selectedTask.completed ? 'Completada \u2713' : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          void toggleTask(selectedTask.id);
                          setSelectedTask({ ...selectedTask, completed: !selectedTask.completed });
                        }}
                        className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                          selectedTask.completed
                            ? 'bg-muted text-foreground hover:bg-muted/80'
                            : 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg'
                        }`}
                      >
                        {selectedTask.completed ? 'Marcar pendiente' : 'Marcar completada'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('\u00bfEst\u00e1s seguro de eliminar esta tarea?')) {
                            void deleteTask(selectedTask.id);
                            setSelectedTask(null);
                          }
                        }}
                        className="px-4 py-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-all font-semibold"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
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
