import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';

export default function AdminPricingRules() {
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products } = useProducts();

  const { data: pricingRules, isLoading } = useQuery({
    queryKey: ['admin-pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*, products(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (rule: any) => {
      if (rule.id) {
        const { error } = await supabase
          .from('pricing_rules')
          .update(rule)
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pricing_rules').insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
      toast({ title: 'Pricing rule saved successfully' });
      setOpen(false);
      setEditingRule(null);
    },
    onError: () => {
      toast({ title: 'Error saving pricing rule', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
      toast({ title: 'Pricing rule deleted successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rule = {
      id: editingRule?.id,
      product_id: formData.get('product_id') as string,
      rule_name: formData.get('rule_name') as string,
      rule_type: formData.get('rule_type') as string,
      discount_type: formData.get('discount_type') as string,
      discount_value: Number(formData.get('discount_value')),
      min_quantity: Number(formData.get('min_quantity')) || null,
      conditions: {},
      is_active: formData.get('is_active') === 'true',
    };
    mutation.mutate(rule);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pricing Rules</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingRule(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="product_id">Product</Label>
                <Select name="product_id" defaultValue={editingRule?.product_id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rule_name">Rule Name</Label>
                <Input id="rule_name" name="rule_name" defaultValue={editingRule?.rule_name} required />
              </div>
              <div>
                <Label htmlFor="rule_type">Rule Type</Label>
                <Select name="rule_type" defaultValue={editingRule?.rule_type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume">Volume Discount</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discount_type">Discount Type</Label>
                <Select name="discount_type" defaultValue={editingRule?.discount_type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discount_value">Discount Value</Label>
                <Input id="discount_value" name="discount_value" type="number" step="0.01" defaultValue={editingRule?.discount_value} required />
              </div>
              <div>
                <Label htmlFor="min_quantity">Minimum Quantity</Label>
                <Input id="min_quantity" name="min_quantity" type="number" defaultValue={editingRule?.min_quantity} />
              </div>
              <div>
                <Label htmlFor="is_active">Status</Label>
                <Select name="is_active" defaultValue={editingRule?.is_active ? 'true' : 'false'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save Rule</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingRules?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.rule_name}</TableCell>
                <TableCell>{rule.products?.name || 'All'}</TableCell>
                <TableCell>{rule.rule_type}</TableCell>
                <TableCell>
                  {rule.discount_type === 'percentage' 
                    ? `${rule.discount_value}%` 
                    : `$${Number(rule.discount_value).toFixed(2)}`}
                </TableCell>
                <TableCell>{rule.min_quantity || '-'}</TableCell>
                <TableCell>{rule.is_active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingRule(rule);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
