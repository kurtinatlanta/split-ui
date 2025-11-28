import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

function CompleteTaskUI() {
  const { currentIntent, tasks, toggleTask, clearIntent, addMessage } = useAppStore();

  const entities = currentIntent?.entities || {};
  const taskIdentifier = (entities.taskIdentifier as string) || '';

  // Find matching tasks (by partial title match)
  const matchingTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(taskIdentifier.toLowerCase())
  );

  const handleComplete = (taskId: string, taskTitle: string) => {
    toggleTask(taskId);
    addMessage('assistant', `Task "${taskTitle}" has been marked as complete.`);
    clearIntent();
  };

  return (
    <div className="complete-task-ui">
      <h3>Complete Task</h3>
      {taskIdentifier && (
        <p className="search-query">Looking for: "{taskIdentifier}"</p>
      )}
      {matchingTasks.length === 0 ? (
        <div>
          <p>No matching tasks found.</p>
          <p>Available tasks:</p>
          <ul className="task-list">
            {tasks
              .filter((task) => !task.completed)
              .map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => handleComplete(task.id, task.title)}
                    className="task-item-button"
                  >
                    <span className="task-title">{task.title}</span>
                    {task.dueDate && (
                      <span className="task-due">Due: {task.dueDate}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <div>
          <p>Select task to complete:</p>
          <ul className="task-list">
            {matchingTasks
              .filter((task) => !task.completed)
              .map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => handleComplete(task.id, task.title)}
                    className="task-item-button"
                  >
                    <span className="task-title">{task.title}</span>
                    {task.dueDate && (
                      <span className="task-due">Due: {task.dueDate}</span>
                    )}
                    <span className={`task-priority ${task.priority}`}>
                      {task.priority}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <button onClick={clearIntent} className="secondary">
        Cancel
      </button>
    </div>
  );
}

export const completeTask: IntentDefinition = {
  name: 'complete_task',
  description: 'Mark a task as completed',
  component: CompleteTaskUI,
  entities: {
    type: 'object',
    properties: {
      taskIdentifier: {
        type: 'string',
        description: 'Task identifier - title or partial title',
      },
    },
    required: ['taskIdentifier'],
  },
};
