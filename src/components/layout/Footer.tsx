import { Rocket, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/lib/site-settings-context';

export function Footer() {
  const { settings } = useSiteSettings();

  return (
    <footer className="border-t border-border/50 bg-card/30 py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold font-display">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt={settings.site_name} className="h-5 w-5 object-contain" />
                ) : (
                  <Rocket className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              <span className="gradient-text">{settings?.site_name || 'CryptoLaunch'}</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {settings?.site_description || 'The next-generation crypto launchpad platform. Buy and sell tokens with M-PESA.'}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/launchpad" className="hover:text-primary transition-colors">Launchpad</Link></li>
              <li><Link to="/dashboard" className="hover:text-primary transition-colors">Portfolio</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/jobs" className="hover:text-primary transition-colors">Careers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {settings?.contact_email && (
                <li className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <a href={`mailto:${settings.contact_email}`} className="hover:text-primary transition-colors">
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings?.contact_phone && (
                <li className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-0.5 shrink-0" />
                  <a href={`tel:${settings.contact_phone}`} className="hover:text-primary transition-colors">
                    {settings.contact_phone}
                  </a>
                </li>
              )}
              {settings?.contact_address && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{settings.contact_address}</span>
                </li>
              )}
              {!settings?.contact_email && !settings?.contact_phone && !settings?.contact_address && (
                <li>No contact information available</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings?.site_name || 'CryptoLaunch'}. All rights reserved. Kenya.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Twitter
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Discord
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Telegram
            </a>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="mt-8 p-4 rounded-lg bg-warning/5 border border-warning/20">
          <p className="text-xs text-muted-foreground text-center">
            <strong className="text-warning">Risk Warning:</strong> Trading cryptocurrencies carries a high level of risk and may not be suitable for all investors. The value of tokens can be extremely volatile. You could lose some or all of your investment. We are NOT responsible for any "rug pulls" or malicious activities by token creators. Always do your own research.
          </p>
        </div>
      </div>
    </footer>
  );
}
