import { useState } from 'react';
import { useAdminReviews, useModerateReview, useDeleteReview } from '@/hooks/useReviews';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StarRating } from '@/components/StarRating';
import { Check, X, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AdminReviews = () => {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const { data: reviews = [], isLoading } = useAdminReviews(filter);
  const moderate = useModerateReview();
  const del = useDeleteReview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Moderation</h1>
        <p className="text-muted-foreground">Approve, reject, or remove customer reviews.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No reviews in this view.</Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.products?.name ?? 'Unknown product'}</span>
                    <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {r.status}
                    </Badge>
                    {r.is_verified_purchase && (
                      <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" /> Verified</Badge>
                    )}
                  </div>
                  <StarRating value={r.rating} readOnly size={14} />
                  {r.title && <p className="font-medium">{r.title}</p>}
                  {r.content && <p className="text-sm text-muted-foreground">{r.content}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {r.status !== 'approved' && (
                    <Button size="sm" onClick={() => moderate.mutate({ id: r.id, status: 'approved' })}>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, status: 'rejected' })}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
