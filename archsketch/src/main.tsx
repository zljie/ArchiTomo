import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './Studio';
import './style.css';
import { BROWSER_MODE, installBrowserBackend } from './browser/install.ts';

if (BROWSER_MODE) installBrowserBackend();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
