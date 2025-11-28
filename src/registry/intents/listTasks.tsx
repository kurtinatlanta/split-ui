import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

function ListTasksUI() {
  const { tasks, toggleTask, clearIntent } = useAppStore();

  return (
    <div className="list-tasks-ui">
      <h3>Your Tasks</h3>
      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.completed ? 'completed' : ''}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
              />
              <span className="task-title">{task.title}</span>
              {task.dueDate && (
                <span className="task-due">Due: {task.dueDate}</span>
              )}
              <span className={`task-priority ${task.priority}`}>
                {task.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={clearIntent}>Close</button>
    </div>
  );
}

export const listTasks: IntentDefinition = {
  name: 'list_tasks',
  description: 'View current tasks with optional filtering',
  component: ListTasksUI,
  entities: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'completed', 'pending'],
        description: 'Task filter',
      },
    },
  },
};
