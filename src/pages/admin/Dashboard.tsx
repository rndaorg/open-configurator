import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, FolderTree, ShoppingCart, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [products, categories, orders, revenue] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_price'),
      ]);

      const totalRevenue = revenue.data?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;

      return {
        products: products.count || 0,
        categories: categories.count || 0,
        orders: orders.count || 0,
        revenue: totalRevenue,
      };
    },
  });

  const cards = [
    { title: 'Total Products', value: stats?.products || 0, icon: Package, color: 'text-blue-600' },
    { title: 'Categories', value: stats?.categories || 0, icon: FolderTree, color: 'text-green-600' },
    { title: 'Total Orders', value: stats?.orders || 0, icon: ShoppingCart, color: 'text-purple-600' },
    { title: 'Revenue', value: `$${(stats?.revenue || 0).toFixed(2)}`, icon: DollarSign, color: 'text-yellow-600' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn('h-5 w-5', card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
