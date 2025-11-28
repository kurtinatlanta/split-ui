import { useState } from 'react';
import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

function AddTaskUI() {
  const { currentIntent, addTask, clearIntent, addMessage } = useAppStore();

  const entities = currentIntent?.entities || {};
  const [title, setTitle] = useState((entities.title as string) || '');
  const [dueDate, setDueDate] = useState((entities.dueDate as string) || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(
    (entities.priority as 'low' | 'medium' | 'high') || 'medium'
  );

  const handleCreate = () => {
    addTask({
      title: title || 'Untitled Task',
      dueDate: dueDate || undefined,
      priority,
      completed: false,
    });
    addMessage('assistant', `Task "${title}" has been created.`);
    clearIntent();
  };

  return (
    <div className="add-task-ui">
      <h3>Create Task</h3>
      <div className="form-field">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
        />
      </div>
      <div className="form-field">
        <label>Due Date</label>
        <input
          type="text"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          placeholder="e.g., Friday, next week, 2025-01-15"
        />
      </div>
      <div className="form-field">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <button onClick={handleCreate}>Create Task</button>
      <button onClick={clearIntent} className="secondary">
        Cancel
      </button>
    </div>
  );
}

export const addTask: IntentDefinition = {
  name: 'add_task',
  description: 'Create a new task with optional due date and priority',
  component: AddTaskUI,
  entities: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in natural language',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Task priority',
      },
    },
    required: ['title'],
  },
};
