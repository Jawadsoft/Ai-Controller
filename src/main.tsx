import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('Main.tsx starting...');
console.log('Document root element:', document.getElementById("root"));

try {
  createRoot(document.getElementById("root")!).render(<App />);
  console.log('App rendered successfully');
} catch (error) {
  console.error('Error rendering app:', error);
}
