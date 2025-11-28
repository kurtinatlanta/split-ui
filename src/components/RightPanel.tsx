import { useAppStore } from '../store';
import { useState, useEffect } from 'react';
import { getIntent } from '../registry';

export function RightPanel() {
  const { panelMode, currentIntent, setPanelMode } = useAppStore();
  const [autoSwitchCountdown, setAutoSwitchCountdown] = useState<number | null>(null);

  // Get intent definition if available
  const intentDef = currentIntent ? getIntent(currentIntent.name) : null;

  // Auto-switch to task UI after 3 seconds if high confidence intent is detected
  useEffect(() => {
    if (
      panelMode === 'context' &&
      currentIntent &&
      currentIntent.confidence >= 0.8 &&
      intentDef
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
  }, [panelMode, currentIntent, intentDef, setPanelMode]);

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
              {intentDef && (
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
            <ConversationStats />
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
        {intentDef ? (
          <intentDef.component />
        ) : (
          <div>No task UI available for this intent</div>
        )}
      </div>
    </div>
  );
}

function ConversationStats() {
  const { messages, tasks } = useAppStore();
  return (
    <>
      <p>{messages.length} messages exchanged</p>
      <p>{tasks.length} tasks in system</p>
    </>
  );
}

