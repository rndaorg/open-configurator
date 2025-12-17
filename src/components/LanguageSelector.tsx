import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/contexts/LocaleContext';
import { languages, type LanguageCode } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'select';
  showCurrency?: boolean;
}

export function LanguageSelector({ variant = 'dropdown', showCurrency = false }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { language, setLanguage, currency, setCurrency, availableCurrencies } = useLocale();
  
  const currentLanguage = languages.find(l => l.code === language);

  if (variant === 'select') {
    return (
      <div className="flex gap-2">
        <Select value={language} onValueChange={(val) => setLanguage(val as LanguageCode)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('settings.language')} />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {showCurrency && (
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder={t('settings.currency')} />
            </SelectTrigger>
            <SelectContent>
              {availableCurrencies.map((curr) => (
                <SelectItem key={curr} value={curr}>
                  {curr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Globe className="h-5 w-5" />
          <span className="sr-only">{t('settings.language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? 'bg-accent' : ''}
          >
            <span className={lang.dir === 'rtl' ? 'font-arabic' : ''}>
              {lang.name}
            </span>
            {language === lang.code && (
              <span className="ms-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        
        {showCurrency && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('settings.currency')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableCurrencies.map((curr) => (
              <DropdownMenuItem
                key={curr}
                onClick={() => setCurrency(curr)}
                className={currency === curr ? 'bg-accent' : ''}
              >
                {curr}
                {currency === curr && (
                  <span className="ms-auto text-xs text-muted-foreground">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
