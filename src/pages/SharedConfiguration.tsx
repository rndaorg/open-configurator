import { useParams } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useResolveShare } from '@/hooks/useSharedConfiguration';
import { ProductConfigurator } from '@/components/ProductConfigurator';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SharedConfiguration = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { share, loading, error } = useResolveShare(shareToken);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-2xl mx-auto px-6 py-24">
          <Card className="p-8 text-center space-y-2">
            <h1 className="text-2xl font-bold">Share link not found</h1>
            <p className="text-muted-foreground">
              {error ?? 'This shared configuration is no longer available.'}
            </p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <ProductConfigurator
        productId={share.product_id}
        onBack={() => navigate('/products')}
        initialOptions={share.configuration_data?.selectedOptions ?? share.configuration_data}
        sharedConfigId={share.id}
        isCollaborative={share.is_collaborative}
        allowEdits={share.allow_edits}
        sharedName={share.configuration_name}
      />
      <Footer />
    </div>
  );
};

export default SharedConfiguration;
