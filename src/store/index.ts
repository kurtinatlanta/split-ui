import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, Intent, Task, PanelMode, TaskUIType } from '../types';

interface AppState {
  // Chat state
  messages: Message[];
  isProcessing: boolean;

  // Intent detection
  currentIntent: Intent | null;

  // Right panel
  panelMode: PanelMode;
  taskUIType: TaskUIType;

  // Domain data
  tasks: Task[];

  // Actions
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  setProcessing: (processing: boolean) => void;
  setIntent: (intent: Intent | null) => void;
  setPanelMode: (mode: PanelMode) => void;
  setTaskUIType: (type: TaskUIType) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  toggleTask: (id: string) => void;
  clearIntent: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      messages: [],
      isProcessing: false,
      currentIntent: null,
      panelMode: 'context',
      taskUIType: 'none',
      tasks: [],

      // Actions
      addMessage: (role, content) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              role,
              content,
              timestamp: Date.now(),
            },
          ],
        })),

      setProcessing: (processing) => set({ isProcessing: processing }),

      setIntent: (intent) => set({ currentIntent: intent }),

      setPanelMode: (mode) => set({ panelMode: mode }),

      setTaskUIType: (type) => set({ taskUIType: type }),

      addTask: (taskData) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              ...taskData,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
          ],
        })),

      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, completed: !task.completed } : task
          ),
        })),

      clearIntent: () =>
        set({
          currentIntent: null,
          panelMode: 'context',
          taskUIType: 'none',
        }),
    }),
    {
      name: 'split-ui-storage',
      // Only persist specific slices (not transient UI state)
      partialize: (state) => ({
        tasks: state.tasks,
        messages: state.messages,
      }),
    }
  )
);
