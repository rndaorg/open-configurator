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

export default function AdminConfigOptions() {
  const [open, setOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products } = useProducts();

  const { data: configOptions, isLoading } = useQuery({
    queryKey: ['admin-config-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_options')
        .select('*, products(name)')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (option: any) => {
      if (option.id) {
        const { error } = await supabase
          .from('config_options')
          .update(option)
          .eq('id', option.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('config_options').insert(option);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-options'] });
      toast({ title: 'Config option saved successfully' });
      setOpen(false);
      setEditingOption(null);
    },
    onError: () => {
      toast({ title: 'Error saving config option', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('config_options').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config-options'] });
      toast({ title: 'Config option deleted successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const option = {
      id: editingOption?.id,
      product_id: formData.get('product_id') as string,
      name: formData.get('name') as string,
      option_type: formData.get('option_type') as string,
      is_required: formData.get('is_required') === 'true',
      display_order: Number(formData.get('display_order')),
    };
    mutation.mutate(option);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Configuration Options</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingOption(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOption ? 'Edit Config Option' : 'Add Config Option'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="product_id">Product</Label>
                <Select name="product_id" defaultValue={editingOption?.product_id}>
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
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={editingOption?.name} required />
              </div>
              <div>
                <Label htmlFor="option_type">Type</Label>
                <Select name="option_type" defaultValue={editingOption?.option_type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">Color</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="is_required">Required</Label>
                <Select name="is_required" defaultValue={editingOption?.is_required ? 'true' : 'false'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="display_order">Display Order</Label>
                <Input id="display_order" name="display_order" type="number" defaultValue={editingOption?.display_order || 0} />
              </div>
              <Button type="submit" className="w-full">Save Option</Button>
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
              <TableHead>Product</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configOptions?.map((option) => (
              <TableRow key={option.id}>
                <TableCell>{option.products?.name}</TableCell>
                <TableCell>{option.name}</TableCell>
                <TableCell>{option.option_type}</TableCell>
                <TableCell>{option.is_required ? 'Yes' : 'No'}</TableCell>
                <TableCell>{option.display_order}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingOption(option);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(option.id)}
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
