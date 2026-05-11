import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../services/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  completed: boolean;
}

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'completed'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  const mapApiTask = (task: {
    id: string;
    title: string;
    description: string;
    dueAt?: string;
    dueDate?: string;
    completed: boolean;
  }): Task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: new Date(task.dueAt || task.dueDate || new Date().toISOString()),
    completed: task.completed,
  });

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      return;
    }

    try {
      const payload = await apiRequest<{ tasks: Array<{
        id: string;
        title: string;
        description: string;
        dueAt?: string;
        dueDate?: string;
        completed: boolean;
      }> }>(`/tasks?userId=${encodeURIComponent(user.id)}`);

      setTasks(payload.tasks.map(mapApiTask));
    } catch {
      setTasks([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = async (task: Omit<Task, 'id' | 'completed'>) => {
    if (!user?.id) {
      return;
    }

    await apiRequest<{ task: unknown }>('/tasks', {
      method: 'POST',
      body: {
        userId: user.id,
        title: task.title,
        description: task.description,
        dueAt: task.dueDate.toISOString(),
      },
    });

    await loadTasks();
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    await apiRequest<{ task: unknown }>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        title: updates.title,
        description: updates.description,
        dueAt: updates.dueDate ? updates.dueDate.toISOString() : undefined,
        completed: updates.completed,
      },
    });

    await loadTasks();
  };

  const deleteTask = async (id: string) => {
    await apiRequest<void>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    await loadTasks();
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return;
    }

    await updateTask(id, { completed: !task.completed });
  };

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, toggleTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
