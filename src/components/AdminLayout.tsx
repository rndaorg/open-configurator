import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, FolderTree, Settings, DollarSign, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Footer from './Footer';

export default function AdminLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const navigation = [
    { name: t('admin.dashboard'), href: '/admin', icon: LayoutDashboard },
    { name: t('admin.products'), href: '/admin/products', icon: Package },
    { name: t('admin.categories'), href: '/admin/categories', icon: FolderTree },
    { name: t('admin.configOptions'), href: '/admin/config-options', icon: Settings },
    { name: t('admin.pricingRules'), href: '/admin/pricing-rules', icon: DollarSign },
    { name: t('admin.orders'), href: '/admin/orders', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        <aside className="w-64 bg-muted/30 border-e">
          <div className="p-6">
            <h2 className="text-lg font-semibold">{t('nav.admin')}</h2>
          </div>
          <nav className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
