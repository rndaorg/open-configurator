import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Warehouse as WarehouseIcon, Truck, Package2, AlertTriangle, BarChart3, Plus, Trash2, RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

type Warehouse = { id: string; name: string; code: string; is_default: boolean; is_active: boolean; address: any };
type Supplier = { id: string; name: string; email?: string; phone?: string; lead_time_days: number; is_active: boolean; contact_name?: string; notes?: string };
type WarehouseInv = { id: string; option_value_id: string; warehouse_id: string; available_quantity: number; reserved_quantity: number; reorder_point: number; reorder_quantity: number; low_stock_threshold: number };
type Batch = { id: string; option_value_id: string; warehouse_id: string; supplier_id: string | null; batch_number: string; quantity: number; remaining_quantity: number; received_at: string; expires_at: string | null; status: string; cost_price: number };

function exportCsv(filename: string, rows: any[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function AdminInventory() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package2 className="h-7 w-7" /> Inventory Management</h1>
      </div>
      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stock"><Package2 className="h-4 w-4 mr-1" /> Stock</TabsTrigger>
          <TabsTrigger value="warehouses"><WarehouseIcon className="h-4 w-4 mr-1" /> Warehouses</TabsTrigger>
          <TabsTrigger value="suppliers"><Truck className="h-4 w-4 mr-1" /> Suppliers</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 mr-1" /> Alerts</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" /> Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab /></TabsContent>
        <TabsContent value="warehouses"><WarehousesTab /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============= STOCK TAB =============
function StockTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState<string | null>(null);

  const { data: stock = [] } = useQuery({
    queryKey: ['admin-warehouse-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('warehouse_inventory').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data as WarehouseInv[];
    }
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await supabase.from('warehouses').select('*')).data as Warehouse[] || [],
  });
  const { data: optionValues = [] } = useQuery({
    queryKey: ['option-values-all'],
    queryFn: async () => (await supabase.from('option_values').select('id, name')).data || [],
  });
  const ovMap = new Map(optionValues.map((o: any) => [o.id, o.name]));
  const whMap = new Map(warehouses.map(w => [w.id, w]));

  const updateMut = useMutation({
    mutationFn: async (row: Partial<WarehouseInv> & { id: string }) => {
      const { error } = await supabase.from('warehouse_inventory').update(row).eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-warehouse-inventory'] }); toast({ title: 'Updated' }); }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('warehouse_inventory').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-warehouse-inventory'] }); toast({ title: 'Removed' }); }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Multi-Warehouse Stock</CardTitle>
          <CardDescription>Per-warehouse availability, reorder points, and batches</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv('stock.csv', stock.map(s => ({ ...s, sku: ovMap.get(s.option_value_id), warehouse: whMap.get(s.warehouse_id)?.name })))}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <AddStockDialog open={open} setOpen={setOpen} warehouses={warehouses} optionValues={optionValues as any} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Reorder Point</TableHead>
              <TableHead>Reorder Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map(row => {
              const isLow = row.available_quantity <= row.reorder_point;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{ovMap.get(row.option_value_id) || row.option_value_id.slice(0,8)}</TableCell>
                  <TableCell>{whMap.get(row.warehouse_id)?.name || '—'}</TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={row.available_quantity} className="w-24" onBlur={(e) => {
                      const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== row.available_quantity) updateMut.mutate({ id: row.id, available_quantity: v });
                    }} />
                  </TableCell>
                  <TableCell>{row.reserved_quantity}</TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={row.reorder_point} className="w-24" onBlur={(e) => {
                      const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== row.reorder_point) updateMut.mutate({ id: row.id, reorder_point: v });
                    }} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={row.reorder_quantity} className="w-24" onBlur={(e) => {
                      const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== row.reorder_quantity) updateMut.mutate({ id: row.id, reorder_quantity: v });
                    }} />
                  </TableCell>
                  <TableCell>{isLow ? <Badge variant="destructive">Low</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setBatchOpen(row.id)}>Batches</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {stock.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No stock records yet. Add one to start tracking.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {batchOpen && <BatchDialog row={stock.find(s => s.id === batchOpen)!} onClose={() => setBatchOpen(null)} ovName={ovMap.get(stock.find(s => s.id === batchOpen)!.option_value_id)} />}
      </CardContent>
    </Card>
  );
}

function AddStockDialog({ open, setOpen, warehouses, optionValues }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ option_value_id: '', warehouse_id: '', available_quantity: 0, reorder_point: 10, reorder_quantity: 50, low_stock_threshold: 10 });
  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('warehouse_inventory').insert(form); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-warehouse-inventory'] }); setOpen(false); toast({ title: 'Stock record added' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Stock</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Warehouse Stock</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>SKU (option value)</Label>
            <Select value={form.option_value_id} onValueChange={v => setForm({ ...form, option_value_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{optionValues.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Warehouse</Label>
            <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{warehouses.map((w: Warehouse) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Available</Label><Input type="number" value={form.available_quantity} onChange={e => setForm({ ...form, available_quantity: +e.target.value })} /></div>
            <div><Label>Low Stock Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: +e.target.value })} /></div>
            <div><Label>Reorder Point</Label><Input type="number" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: +e.target.value })} /></div>
            <div><Label>Reorder Qty</Label><Input type="number" value={form.reorder_quantity} onChange={e => setForm({ ...form, reorder_quantity: +e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.option_value_id || !form.warehouse_id}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchDialog({ row, onClose, ovName }: { row: WarehouseInv; onClose: () => void; ovName?: string }) {
  const qc = useQueryClient();
  const { data: batches = [] } = useQuery({
    queryKey: ['batches', row.option_value_id, row.warehouse_id],
    queryFn: async () => (await supabase.from('inventory_batches').select('*').eq('option_value_id', row.option_value_id).eq('warehouse_id', row.warehouse_id).order('received_at', { ascending: false })).data as Batch[] || [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await supabase.from('suppliers').select('id, name')).data || [],
  });
  const [form, setForm] = useState({ batch_number: '', quantity: 0, cost_price: 0, supplier_id: '', expires_at: '' });
  const add = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, option_value_id: row.option_value_id, warehouse_id: row.warehouse_id, remaining_quantity: form.quantity };
      if (!payload.supplier_id) delete payload.supplier_id;
      if (!payload.expires_at) delete payload.expires_at;
      const { error } = await supabase.from('inventory_batches').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); toast({ title: 'Batch added' }); setForm({ batch_number: '', quantity: 0, cost_price: 0, supplier_id: '', expires_at: '' }); }
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Batches — {ovName}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Batch #</TableHead><TableHead>Qty</TableHead><TableHead>Remaining</TableHead><TableHead>Received</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {batches.map(b => (
              <TableRow key={b.id}><TableCell>{b.batch_number}</TableCell><TableCell>{b.quantity}</TableCell><TableCell>{b.remaining_quantity}</TableCell><TableCell>{new Date(b.received_at).toLocaleDateString()}</TableCell><TableCell>{b.expires_at ? new Date(b.expires_at).toLocaleDateString() : '—'}</TableCell><TableCell><Badge variant={b.status === 'active' ? 'outline' : 'secondary'}>{b.status}</Badge></TableCell></TableRow>
            ))}
            {batches.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No batches</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-semibold">Add Batch</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Batch number" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
            <Input type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} />
            <Input type="number" step="0.01" placeholder="Cost price" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: +e.target.value })} />
            <Input type="date" placeholder="Expires" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Supplier (optional)" /></SelectTrigger>
              <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => add.mutate()} disabled={!form.batch_number || !form.quantity}>Add Batch</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============= WAREHOUSES TAB =============
function WarehousesTab() {
  const qc = useQueryClient();
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await supabase.from('warehouses').select('*').order('created_at')).data as Warehouse[] || [],
  });
  const [form, setForm] = useState({ name: '', code: '', is_default: false });
  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('warehouses').insert(form); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); setForm({ name: '', code: '', is_default: false }); toast({ title: 'Warehouse added' }); }
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('warehouses').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Warehouses</CardTitle><CardDescription>Manage your storage locations</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Code (unique)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={!form.name || !form.code}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Default</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {warehouses.map(w => (
              <TableRow key={w.id}>
                <TableCell>{w.name}</TableCell><TableCell><code>{w.code}</code></TableCell>
                <TableCell>{w.is_default && <Badge>Default</Badge>}</TableCell>
                <TableCell>{w.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => remove.mutate(w.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============= SUPPLIERS TAB =============
function SuppliersTab() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-full'],
    queryFn: async () => (await supabase.from('suppliers').select('*').order('created_at')).data as Supplier[] || [],
  });
  const [form, setForm] = useState({ name: '', email: '', phone: '', contact_name: '', lead_time_days: 7, notes: '' });
  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('suppliers').insert(form); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers-full'] }); setForm({ name: '', email: '', phone: '', contact_name: '', lead_time_days: 7, notes: '' }); toast({ title: 'Supplier added' }); }
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('suppliers').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers-full'] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Suppliers</CardTitle><CardDescription>Vendors and their lead times</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Contact name" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input type="number" placeholder="Lead time (days)" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days: +e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={!form.name}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
        </div>
        <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Lead time</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {suppliers.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell><TableCell>{s.contact_name || '—'}</TableCell><TableCell>{s.email || '—'}</TableCell>
                <TableCell>{s.lead_time_days} days</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============= ALERTS TAB =============
function AlertsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['reorder-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('inventory-reorder-suggestions', { body: { status: 'pending' } });
      if (error) throw error;
      return data as { alerts: any[] };
    }
  });
  const updateAlert = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('reorder_alerts').update({ status, resolved_at: status !== 'pending' ? new Date().toISOString() : null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reorder-alerts'] }); toast({ title: 'Updated' }); }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Reorder Alerts</CardTitle><CardDescription>Items at or below reorder point</CardDescription></div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['reorder-alerts'] })}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Warehouse</TableHead><TableHead>Current</TableHead><TableHead>Reorder Pt</TableHead><TableHead>Suggested Qty</TableHead><TableHead>Supplier</TableHead><TableHead>Triggered</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.alerts || []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.option_name}</TableCell>
                  <TableCell>{a.warehouse?.name || '—'}</TableCell>
                  <TableCell><Badge variant="destructive">{a.current_quantity}</Badge></TableCell>
                  <TableCell>{a.reorder_point}</TableCell>
                  <TableCell className="font-semibold">{a.suggested_quantity}</TableCell>
                  <TableCell>{a.supplier?.name || <span className="text-muted-foreground">No supplier</span>}</TableCell>
                  <TableCell>{new Date(a.triggered_at).toLocaleDateString()}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="default" onClick={() => updateAlert.mutate({ id: a.id, status: 'ordered' })}>Mark Ordered</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateAlert.mutate({ id: a.id, status: 'dismissed' })}>Dismiss</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data?.alerts || []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No pending reorder alerts</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============= REPORTS TAB =============
function ReportsTab() {
  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => (await supabase.from('products').select('id, name')).data || [],
  });
  const [productId, setProductId] = useState<string>('');

  const { data: forecast } = useQuery({
    queryKey: ['inventory-forecast', productId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('inventory-forecast', { body: { product_id: productId || undefined, horizon_days: 30, history_days: 90 } });
      if (error) throw error;
      return data as any;
    }
  });

  const { data: stockByWarehouse = [] } = useQuery({
    queryKey: ['stock-by-warehouse'],
    queryFn: async () => {
      const { data: stock } = await supabase.from('warehouse_inventory').select('warehouse_id, available_quantity');
      const { data: whs } = await supabase.from('warehouses').select('id, name');
      const map = new Map<string, number>();
      (stock || []).forEach(s => map.set(s.warehouse_id, (map.get(s.warehouse_id) || 0) + s.available_quantity));
      return (whs || []).map(w => ({ name: w.name, stock: map.get(w.id) || 0 }));
    }
  });

  const { data: expiringBatches = [] } = useQuery({
    queryKey: ['expiring-batches'],
    queryFn: async () => {
      const cutoff = new Date(Date.now() + 90 * 86400000).toISOString();
      const { data } = await supabase.from('inventory_batches').select('*').not('expires_at', 'is', null).lte('expires_at', cutoff).eq('status', 'active').order('expires_at');
      return data || [];
    }
  });

  const chartData = forecast ? [
    ...forecast.history.map((h: any) => ({ date: h.date, actual: h.qty })),
    ...forecast.projection.map((p: any) => ({ date: p.date, projected: p.projected_qty })),
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Stock</CardDescription><CardTitle className="text-3xl">{forecast?.metrics?.total_stock_on_hand ?? '—'}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Daily Demand (7d)</CardDescription><CardTitle className="text-3xl">{forecast?.metrics?.avg7_daily ?? '—'}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Days of Stock</CardDescription><CardTitle className="text-3xl">{forecast?.metrics?.days_of_stock_remaining ?? '—'}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Reorder In</CardDescription><CardTitle className="text-3xl">{forecast?.metrics?.recommended_reorder_in_days ?? '—'}d</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sales-Trend Forecast</CardTitle>
            <CardDescription>Historical sales (last 90d) vs projected demand (next 30d)</CardDescription>
          </div>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All products</SelectItem>
              {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" dot={false} name="Actual sales" />
              <Line type="monotone" dataKey="projected" stroke="hsl(var(--accent))" strokeDasharray="5 5" dot={false} name="Projected demand" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Stock by Warehouse</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stockByWarehouse}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis /><Tooltip />
                <Bar dataKey="stock" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Batch Expiry (next 90d)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportCsv('expiring-batches.csv', expiringBatches)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Qty Left</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
              <TableBody>
                {expiringBatches.slice(0, 10).map((b: any) => (
                  <TableRow key={b.id}><TableCell>{b.batch_number}</TableCell><TableCell>{b.remaining_quantity}</TableCell><TableCell>{new Date(b.expires_at).toLocaleDateString()}</TableCell></TableRow>
                ))}
                {expiringBatches.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">None expiring soon</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
