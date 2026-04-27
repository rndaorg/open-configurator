import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface WishlistButtonProps {
  productId: string;
  configurationData?: any;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export const WishlistButton = ({
  productId,
  configurationData,
  variant = 'outline',
  size = 'sm',
  className,
  showLabel = true,
}: WishlistButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, add, remove, isInWishlist } = useWishlist();
  const inList = isInWishlist(productId);
  const existing = items.find((i) => i.product_id === productId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Sign in to use your wishlist');
      navigate('/auth');
      return;
    }
    if (inList && existing) {
      await remove(existing.id);
    } else {
      await add({ productId, configurationData });
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      aria-label={inList ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        className={`w-4 h-4 ${showLabel ? 'mr-2' : ''} ${
          inList ? 'fill-destructive text-destructive' : ''
        }`}
      />
      {showLabel && (inList ? 'Saved' : 'Save')}
    </Button>
  );
};
