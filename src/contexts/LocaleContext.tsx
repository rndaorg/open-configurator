import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, rtlLanguages, type LanguageCode } from '@/lib/i18n';

// Exchange rates relative to USD (simplified - in production use real API)
const exchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  SAR: 3.75,
  JPY: 149.50,
  CNY: 7.24,
  INR: 83.12,
  AUD: 1.53,
  CAD: 1.36,
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: '﷼',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
};

interface LocaleContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  isRTL: boolean;
  locale: string;
  formatCurrency: (amount: number, fromCurrency?: string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date | string) => string;
  convertCurrency: (amount: number, from: string, to: string) => number;
  availableCurrencies: string[];
  dir: 'ltr' | 'rtl';
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem('language');
    return (stored as LanguageCode) || 'en';
  });
  
  const [currency, setCurrencyState] = useState(() => {
    const stored = localStorage.getItem('currency');
    return stored || 'USD';
  });

  const languageConfig = languages.find(l => l.code === language) || languages[0];
  const isRTL = rtlLanguages.includes(language);
  const locale = languageConfig.locale;
  const dir = isRTL ? 'rtl' : 'ltr';

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    
    // Update document direction for RTL support
    const newConfig = languages.find(l => l.code === lang);
    if (newConfig) {
      document.documentElement.dir = newConfig.dir;
      document.documentElement.lang = lang;
    }
  }, [i18n]);

  const setCurrency = useCallback((curr: string) => {
    setCurrencyState(curr);
    localStorage.setItem('currency', curr);
  }, []);

  const convertCurrency = useCallback((amount: number, from: string, to: string): number => {
    const fromRate = exchangeRates[from] || 1;
    const toRate = exchangeRates[to] || 1;
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }, []);

  const formatCurrency = useCallback((amount: number, fromCurrency: string = 'USD'): string => {
    const convertedAmount = convertCurrency(amount, fromCurrency, currency);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
  }, [currency, locale, convertCurrency]);

  const formatNumber = useCallback((num: number, options?: Intl.NumberFormatOptions): string => {
    return new Intl.NumberFormat(locale, options).format(num);
  }, [locale]);

  const formatDate = useCallback((date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    };
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  }, [locale]);

  const formatRelativeTime = useCallback((date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, 'second');
    } else if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    } else if (diffInSeconds < 86400) {
      return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    } else if (diffInSeconds < 2592000) {
      return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    } else if (diffInSeconds < 31536000) {
      return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
    } else {
      return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
    }
  }, [locale]);

  // Initialize language and direction on mount
  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir, i18n]);

  const value: LocaleContextType = {
    language,
    setLanguage,
    currency,
    setCurrency,
    isRTL,
    locale,
    formatCurrency,
    formatNumber,
    formatDate,
    formatRelativeTime,
    convertCurrency,
    availableCurrencies: Object.keys(exchangeRates),
    dir,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
