import { useState } from 'react';
import { useAppStore } from '../store';
import { getLLMProvider } from '../services/llm-factory';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const {
    messages,
    tasks,
    isProcessing,
    addMessage,
    setProcessing,
    setIntent,
    setPanelMode,
    clearMessages
  } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    addMessage('user', userMessage);
    setInput('');
    setProcessing(true);

    try {
      // Build conversation history for context
      const history = messages.map(m => m.content);

      // Add task context for AI awareness
      const taskContext = tasks.length > 0
        ? `\n\nCurrent tasks:\n${tasks.map(t => `- ${t.title}${t.completed ? ' (completed)' : ''}`).join('\n')}`
        : '\n\nNo tasks in the system yet.';

      // Get the configured LLM provider
      const provider = getLLMProvider();

      // Detect intent and generate response in parallel
      const [intent, response] = await Promise.all([
        provider.detectIntent(userMessage, history),
        provider.generateResponse(userMessage, [...history, taskContext]),
      ]);

      // Add assistant response
      addMessage('assistant', response);

      // Update intent and UI if detected
      if (intent) {
        setIntent(intent);
        setPanelMode('context'); // Show context first
      }
    } catch (error) {
      console.error('Error processing message:', error);

      // Provide more specific error messages
      let errorMessage = 'Sorry, I encountered an error.';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          errorMessage = 'Authentication failed. Please check your API key in .env.local';
        } else if (error.message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      addMessage('assistant', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat</h2>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="clear-chat-button"
            disabled={isProcessing}
            title="Clear conversation history"
          >
            Clear Chat
          </button>
        )}
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            Start a conversation to detect intents...
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-role">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
        {isProcessing && (
          <div className="message assistant">
            <div className="message-role">Assistant</div>
            <div className="message-content">Thinking...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isProcessing}
        />
        <button type="submit" disabled={isProcessing || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
