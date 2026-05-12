import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  average: number;
  count: number;
  className?: string;
}

export const ProductRatingBadge = ({ average, count, className }: Props) => {
  if (!count) return null;
  return (
    <div className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      <span className="font-medium text-foreground">{Number(average).toFixed(1)}</span>
      <span>({count})</span>
    </div>
  );
};
