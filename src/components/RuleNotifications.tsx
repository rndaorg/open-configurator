import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Sparkles, Ban } from 'lucide-react';

interface RuleNotification {
  type: 'restriction' | 'dependency' | 'auto_select' | 'info';
  message: string;
  optionId?: string;
  valueId?: string;
}

interface RuleNotificationsProps {
  notifications: RuleNotification[];
  onApplyAutoSelection?: (optionId: string, valueId: string) => void;
}

export const RuleNotifications = ({ notifications, onApplyAutoSelection }: RuleNotificationsProps) => {
  if (notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'restriction':
        return <Ban className="w-4 h-4 text-destructive" />;
      case 'dependency':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'auto_select':
        return <Sparkles className="w-4 h-4 text-accent" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getVariant = (type: string) => {
    switch (type) {
      case 'restriction':
        return 'destructive';
      case 'dependency':
        return 'default';
      case 'auto_select':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Configuration Rules</h4>
      </div>
      
      <div className="space-y-2">
        {notifications.map((notification, index) => (
          <div
            key={index}
            className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background/50"
          >
            <div className="mt-0.5">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getVariant(notification.type)} className="text-xs">
                  {notification.type.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{notification.message}</p>
              {notification.type === 'auto_select' && notification.optionId && notification.valueId && onApplyAutoSelection && (
                <button
                  onClick={() => onApplyAutoSelection(notification.optionId!, notification.valueId!)}
                  className="text-xs text-accent hover:underline"
                >
                  Apply suggestion
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};