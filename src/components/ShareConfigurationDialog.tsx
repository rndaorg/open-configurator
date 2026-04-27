import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Copy,
  Facebook,
  Linkedin,
  Mail,
  MessageCircle,
  Twitter,
  Loader2,
  Check,
  Users,
} from 'lucide-react';
import { useSharedConfiguration } from '@/hooks/useSharedConfiguration';
import { toast } from 'sonner';

interface ShareConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  configurationData: any;
  totalPrice?: number;
}

export const ShareConfigurationDialog = ({
  open,
  onOpenChange,
  productId,
  productName,
  configurationData,
  totalPrice,
}: ShareConfigurationDialogProps) => {
  const { create } = useSharedConfiguration();
  const [name, setName] = useState('');
  const [collaborative, setCollaborative] = useState(false);
  const [allowEdits, setAllowEdits] = useState(false);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    const result = await create({
      productId,
      configurationData,
      configurationName: name || `Custom ${productName}`,
      totalPrice,
      isCollaborative: collaborative,
      allowEdits: collaborative && allowEdits,
    });
    setCreating(false);
    if (result) {
      const url = `${window.location.origin}/shared/${result.share_token}`;
      setShareUrl(url);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setShareUrl(null);
    setName('');
    setCollaborative(false);
    setAllowEdits(false);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const description = `Check out my custom ${productName}${
    totalPrice ? ` for $${totalPrice.toLocaleString()}` : ''
  }`;

  const socialLinks = shareUrl
    ? {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(description)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`${description} ${shareUrl}`)}`,
        email: `mailto:?subject=${encodeURIComponent(name || `Custom ${productName}`)}&body=${encodeURIComponent(`${description}\n\n${shareUrl}`)}`,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Configuration</DialogTitle>
          <DialogDescription>
            Create a unique link, QR code, and share to social channels.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-name">Configuration name</Label>
              <Input
                id="config-name"
                placeholder={`My ${productName}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="collab" className="flex items-center gap-2">
                  <Users className="w-4 h-4" /> Collaborative session
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show live presence to everyone with the link.
                </p>
              </div>
              <Switch id="collab" checked={collaborative} onCheckedChange={setCollaborative} />
            </div>
            {collaborative && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edits">Allow others to edit</Label>
                  <p className="text-xs text-muted-foreground">
                    Anyone with the link can change selections in real time.
                  </p>
                </div>
                <Switch id="edits" checked={allowEdits} onCheckedChange={setAllowEdits} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy link">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex justify-center bg-card p-4 rounded-lg border">
              <QRCodeCanvas
                value={shareUrl}
                size={180}
                bgColor="hsl(var(--card))"
                fgColor="hsl(var(--foreground))"
                level="M"
                includeMargin
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Share to</p>
              <div className="grid grid-cols-5 gap-2">
                <Button variant="outline" size="icon" asChild>
                  <a href={socialLinks!.facebook} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook">
                    <Facebook className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={socialLinks!.twitter} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter">
                    <Twitter className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={socialLinks!.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
                    <Linkedin className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={socialLinks!.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={socialLinks!.email} aria-label="Share via Email">
                    <Mail className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!shareUrl ? (
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create share link
            </Button>
          ) : (
            <Button variant="outline" onClick={reset} className="w-full">
              Create another link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
