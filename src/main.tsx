import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import '@/lib/i18n'
import { CartProvider } from './contexts/CartContext'
import { LocaleProvider } from './contexts/LocaleContext'

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <LocaleProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </LocaleProvider>
  </HelmetProvider>
);
