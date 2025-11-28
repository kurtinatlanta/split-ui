export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Intent {
  name: string;
  confidence: number;
  entities: Record<string, unknown>;
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: number;
}

export type PanelMode = 'context' | 'task-ui';
