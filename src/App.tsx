import { ChatPanel } from './components/ChatPanel';
import { RightPanel } from './components/RightPanel';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Intent-Driven UI</h1>
      </header>
      <main className="split-layout">
        <ChatPanel />
        <RightPanel />
      </main>
    </div>
  );
}

export default App;
