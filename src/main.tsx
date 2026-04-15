import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@/lib/i18n'
import { CartProvider } from './contexts/CartContext'
import { LocaleProvider } from './contexts/LocaleContext'

createRoot(document.getElementById("root")!).render(
  <LocaleProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </LocaleProvider>
);
