import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FolderTree, Settings, DollarSign, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Footer from './Footer';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Categories', href: '/admin/categories', icon: FolderTree },
  { name: 'Config Options', href: '/admin/config-options', icon: Settings },
  { name: 'Pricing Rules', href: '/admin/pricing-rules', icon: DollarSign },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        <aside className="w-64 bg-muted/30 border-r">
          <div className="p-6">
            <h2 className="text-lg font-semibold">Admin Panel</h2>
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
                  {item.name}
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
