import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Menu, X, LogOut, User, ShoppingCart, Shield } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { LanguageSelector } from '@/components/LanguageSelector';

export const Navigation = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();
  const { isAdmin } = useAdminCheck();

  const navItems = [
    { path: '/', label: t('nav.home') },
    { path: '/features', label: t('nav.features') },
    { path: '/products', label: t('nav.products') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Settings className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Open Configurator
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.path)
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSelector showCurrency />
            <Button variant="ghost" size="sm" className="relative" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-2 -end-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {itemCount}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://github.com/your-username/configuremax', '_blank')}
            >
              GitHub
            </Button>
            {user ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/profile">
                    <User className="h-4 w-4 me-2" />
                    {t('nav.profile')}
                  </Link>
                </Button>
                {isAdmin && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin">
                      <Shield className="h-4 w-4 me-2" />
                      {t('nav.admin')}
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={signOut}>
                  <LogOut className="h-4 w-4 me-2" />
                  {t('nav.logout')}
                </Button>
              </>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth">{t('nav.login')}</Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4">
                <LanguageSelector variant="select" showCurrency />
                <Button variant="outline" size="sm" className="relative" asChild>
                  <Link to="/cart">
                    <ShoppingCart className="h-4 w-4 me-2" />
                    {t('nav.cart')}
                    {itemCount > 0 && (
                      <Badge className="ms-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {itemCount}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://github.com/your-username/configuremax', '_blank')}
                >
                  GitHub
                </Button>
                {user ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/profile">
                        <User className="h-4 w-4 me-2" />
                        {t('nav.profile')}
                      </Link>
                    </Button>
                    {isAdmin && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/admin">
                          <Shield className="h-4 w-4 me-2" />
                          {t('nav.admin')}
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={signOut}>
                      <LogOut className="h-4 w-4 me-2" />
                      {t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" asChild>
                    <Link to="/auth">{t('nav.login')}</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
