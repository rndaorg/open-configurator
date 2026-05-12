import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProductReviews, useProductRatingSummary, useMyReview, useSubmitReview } from '@/hooks/useReviews';
import { StarRating } from '@/components/StarRating';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  productId: string;
  configurationId?: string | null;
}

export const ProductReviews = ({ productId, configurationId }: Props) => {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useProductReviews(productId);
  const { data: summary } = useProductRatingSummary(productId);
  const { data: myReview } = useMyReview(productId, user?.id);
  const submit = useSubmitReview();

  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [title, setTitle] = useState(myReview?.title ?? '');
  const [content, setContent] = useState(myReview?.content ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return;
    submit.mutate({
      product_id: productId,
      rating,
      title: title.trim() || undefined,
      content: content.trim() || undefined,
      configuration_id: configurationId ?? null,
    });
  };

  return (
    <Card className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Reviews</h3>
        {summary && summary.review_count > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={summary.average_rating} readOnly size={18} />
            <span className="text-sm text-muted-foreground">
              {Number(summary.average_rating).toFixed(1)} ({summary.review_count})
            </span>
          </div>
        )}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3 border-b border-border pb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your rating</label>
            <StarRating value={rating} onChange={setRating} size={24} />
          </div>
          <Input
            placeholder="Title (optional)"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Share your experience..."
            value={content}
            maxLength={2000}
            rows={3}
            onChange={(e) => setContent(e.target.value)}
          />
          {myReview && (
            <p className="text-xs text-muted-foreground">
              Your review status: <Badge variant="secondary">{myReview.status}</Badge>
            </p>
          )}
          <Button type="submit" disabled={rating < 1 || submit.isPending}>
            {submit.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {myReview ? 'Update review' : 'Submit review'}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Sign in to leave a review.</p>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StarRating value={r.rating} readOnly size={14} />
                  {r.is_verified_purchase && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
              {r.title && <p className="font-medium">{r.title}</p>}
              {r.content && <p className="text-sm text-muted-foreground">{r.content}</p>}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
