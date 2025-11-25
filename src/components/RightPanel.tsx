import { useAppStore } from '../store';
import { useState, useEffect } from 'react';

export function RightPanel() {
  const { panelMode, currentIntent, taskUIType, tasks, messages, setPanelMode } = useAppStore();
  const [autoSwitchCountdown, setAutoSwitchCountdown] = useState<number | null>(null);

  // Auto-switch to task UI after 3 seconds if high confidence intent is detected
  useEffect(() => {
    if (
      panelMode === 'context' &&
      currentIntent &&
      currentIntent.confidence >= 0.8 &&
      taskUIType !== 'none'
    ) {
      // Start countdown from 3 seconds
      setAutoSwitchCountdown(3);

      const timer = setInterval(() => {
        setAutoSwitchCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            setPanelMode('task-ui');
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setAutoSwitchCountdown(null);
    }
  }, [panelMode, currentIntent, taskUIType, setPanelMode]);

  const cancelAutoSwitch = () => {
    setAutoSwitchCountdown(null);
  };

  if (panelMode === 'context') {
    return (
      <div className="right-panel">
        <div className="panel-header">
          <h2>Context</h2>
        </div>
        <div className="context-content">
          {currentIntent ? (
            <div className="intent-display">
              <h3>Detected Intent</h3>
              <div className="intent-name">{currentIntent.name}</div>
              <div className="intent-confidence">
                Confidence: {(currentIntent.confidence * 100).toFixed(0)}%
              </div>
              {Object.keys(currentIntent.entities).length > 0 && (
                <div className="entities">
                  <h4>Entities</h4>
                  <pre>{JSON.stringify(currentIntent.entities, null, 2)}</pre>
                </div>
              )}
              {taskUIType !== 'none' && (
                <div style={{ marginTop: '1rem' }}>
                  {autoSwitchCountdown !== null ? (
                    <div className="auto-switch-notice">
                      <p>Opening Task UI in {autoSwitchCountdown} seconds...</p>
                      <button onClick={cancelAutoSwitch} className="secondary">
                        Cancel Auto-Switch
                      </button>
                      <button onClick={() => setPanelMode('task-ui')}>
                        Open Now
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setPanelMode('task-ui')}>
                      Open Task UI
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-intent">
              <p>No intent detected yet.</p>
              <p>Try saying something like:</p>
              <ul>
                <li>"Add a task to buy groceries"</li>
                <li>"Show me my tasks"</li>
                <li>"I need to finish the report by Friday"</li>
              </ul>
            </div>
          )}

          <div className="conversation-summary">
            <h3>Conversation Summary</h3>
            <p>{messages.length} messages exchanged</p>
            <p>{tasks.length} tasks in system</p>
          </div>
        </div>
      </div>
    );
  }

  // Task UI mode
  return (
    <div className="right-panel">
      <div className="panel-header">
        <h2>Task UI</h2>
      </div>
      <div className="task-ui-content">
        {taskUIType === 'add-task' && <AddTaskUI />}
        {taskUIType === 'list-tasks' && <ListTasksUI />}
        {taskUIType === 'complete-task' && <CompleteTaskUI />}
        {taskUIType === 'none' && <div>No task UI selected</div>}
      </div>
    </div>
  );
}

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
