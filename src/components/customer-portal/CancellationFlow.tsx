import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ArrowRight, Heart, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  subscriptionId: string;
  tierName: string;
  periodEnd: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelComplete: () => void;
}

const reasons = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'switched_provider', label: 'Switched to another provider' },
  { value: 'not_using', label: 'I\'m not using it enough' },
  { value: 'technical_issues', label: 'Technical issues or bugs' },
  { value: 'other', label: 'Other reason' },
];

export function CancellationFlow({ subscriptionId, tierName, periodEnd, open, onOpenChange, onCancelComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recommendScore, setRecommendScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1); setReason(''); setFeedback(''); setRecommendScore(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) setTimeout(reset, 300);
    onOpenChange(val);
  };

  const handleConfirmCancel = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Save feedback
      await supabase.from('cancellation_feedback').insert({
        user_id: user.id,
        subscription_id: subscriptionId,
        reason,
        feedback: feedback || null,
        would_recommend: recommendScore,
      });

      // Cancel subscription via edge function
      const { error } = await supabase.functions.invoke('subscription-manage', {
        body: { action: 'cancel', subscriptionId },
      });
      if (error) throw error;

      setStep(4);
      toast.success('Your subscription has been canceled');
      onCancelComplete();
    } catch (error) {
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {step === 1 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" />
                <DialogTitle>We're sorry to see you go</DialogTitle>
              </div>
              <DialogDescription>
                Before you cancel your <strong>{tierName}</strong> plan, we'd love to know why.
                Your feedback helps us improve.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm">
                    <strong>Did you know?</strong> You can downgrade to a lower-cost plan instead of canceling.
                    Your data will be preserved.
                  </p>
                </CardContent>
              </Card>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Keep my plan</Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue cancellation <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Why are you canceling?</DialogTitle>
              <DialogDescription>Select the reason that best describes your situation</DialogDescription>
            </DialogHeader>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {reasons.map((r) => (
                <div key={r.value} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="flex-1 cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!reason}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>One last thing</DialogTitle>
              <DialogDescription>
                Help us improve — your feedback is anonymous and goes directly to our product team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Anything you'd like to share? (Optional)</Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what we could have done better..."
                  rows={4}
                  maxLength={1000}
                />
              </div>
              <div>
                <Label>How likely are you to recommend us? (0–10)</Label>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRecommendScore(n)}
                      className={`w-9 h-9 rounded border text-sm font-medium transition ${
                        recommendScore === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {periodEnd && (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/50">
                  <CardContent className="p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Access until end of billing period</p>
                      <p className="text-muted-foreground mt-1">
                        Your subscription will remain active until{' '}
                        <strong>{new Date(periodEnd).toLocaleDateString()}</strong>.
                        After that, you'll be moved to the Free tier.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button variant="destructive" onClick={handleConfirmCancel} disabled={submitting}>
                {submitting ? 'Canceling...' : 'Confirm Cancellation'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 4 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <DialogTitle>Cancellation confirmed</DialogTitle>
              </div>
              <DialogDescription>
                Your subscription has been canceled. Thank you for being a customer.
              </DialogDescription>
            </DialogHeader>
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <p>
                  <strong>What happens next:</strong>
                </p>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  {periodEnd && <li>Continued access until {new Date(periodEnd).toLocaleDateString()}</li>}
                  <li>Automatic downgrade to the Free plan after that date</li>
                  <li>All your data and configurations will be preserved</li>
                  <li>You can reactivate anytime from the pricing page</li>
                </ul>
              </CardContent>
            </Card>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
