import { Github, Mail, Globe, Boxes } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-muted/10 to-background border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Boxes className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold">Open Configurator</span>
            </div>
            <p className="text-muted-foreground text-sm">
              The universal product configurator. Build and customize your perfect products with our intuitive configurator.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold">Product</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="#features" className="block hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="block hover:text-primary transition-colors">Pricing</a>
              <a href="#docs" className="block hover:text-primary transition-colors">Documentation</a>
              <a href="#api" className="block hover:text-primary transition-colors">API Reference</a>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold">Resources</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="/docs/getting-started" className="block hover:text-primary transition-colors">Getting Started</a>
              <a href="/docs/examples" className="block hover:text-primary transition-colors">Examples</a>
              <a href="https://github.com/rndaorg/open-configurator" className="block hover:text-primary transition-colors">GitHub</a>
              <a href="mailto:support@openconfigurator.dev" className="block hover:text-primary transition-colors">Support</a>
            </div>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="font-semibold">Connect</h3>
            <div className="flex gap-3">
              <a 
                href="https://github.com/rndaorg/open-configurator" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-muted hover:bg-muted/80 rounded-lg flex items-center justify-center transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="mailto:hello@openconfigurator.dev"
                className="w-10 h-10 bg-muted hover:bg-muted/80 rounded-lg flex items-center justify-center transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a 
                href="https://openconfigurator.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-muted hover:bg-muted/80 rounded-lg flex items-center justify-center transition-colors"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Open Configurator. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;