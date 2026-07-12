import './styles.css';
import { bootstrapApp } from './app/session-host';

const rootElement = document.querySelector<HTMLElement>('#app');
if (!rootElement) throw new Error('App root is missing');

bootstrapApp(rootElement);
