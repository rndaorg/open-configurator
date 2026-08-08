import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMyTenants } from '@/hooks/useTenants';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';

export const TenantSwitcher = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: tenants } = useMyTenants();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[120px] truncate">{tenant?.name ?? 'Workspaces'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(tenants || []).length === 0 && (
          <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
        )}
        {(tenants || []).map((t) => (
          <DropdownMenuItem key={t.id} asChild>
            <Link to={`/t/${t.slug}`} className="flex justify-between">
              <span className="truncate">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.role}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {tenant && (
          <DropdownMenuItem asChild>
            <Link to={`/t/${tenant.slug}/admin`}>Workspace admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/onboarding" className="gap-2">
            <Plus className="h-4 w-4" /> New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
