import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AdminOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      
      // Fetch products separately
      const productIds = [...new Set(data.map(o => o.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      
      // Merge data
      return data.map(order => ({
        ...order,
        profile: profiles?.find(p => p.id === order.user_id),
        product: products?.find(p => p.id === order.product_id),
      }));
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      processing: 'bg-blue-500',
      shipped: 'bg-purple-500',
      delivered: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Orders Management</h1>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                <TableCell>{order.profile?.email}</TableCell>
                <TableCell>{order.product?.name}</TableCell>
                <TableCell>${Number(order.total_price).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                    {order.payment_status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(order.created_at), 'MMM dd, yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
