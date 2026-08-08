import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ProductConfigurator } from '@/components/ProductConfigurator';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Loader2 } from 'lucide-react';

export default function TenantStorefront() {
  const { tenant, branding, role, loading } = useTenant();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">Workspace not found</h1>
          <p className="text-muted-foreground">This storefront address isn't active.</p>
          <Button asChild><Link to="/onboarding">Create your own workspace</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (selectedProductId) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <ProductConfigurator productId={selectedProductId} onBack={() => setSelectedProductId(null)} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${tenant.name} — Configure your product`}
        description={branding?.tagline || `Browse and configure custom products from ${tenant.name}.`}
        path={`/t/${tenant.slug}`}
      />
      <Navigation />
      <header className="border-b bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center space-y-4">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt={`${tenant.name} logo`} className="h-14 mx-auto object-contain" />
          )}
          <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {tenant.name}
          </h1>
          {branding?.tagline && <p className="text-lg text-muted-foreground">{branding.tagline}</p>}
          {(role === 'owner' || role === 'admin') && (
            <Button variant="outline" asChild>
              <Link to={`/t/${tenant.slug}/admin`}>Workspace admin</Link>
            </Button>
          )}
        </div>
      </header>
      <ProductCatalog onConfigureProduct={setSelectedProductId} />
      <Footer />
    </div>
  );
}
