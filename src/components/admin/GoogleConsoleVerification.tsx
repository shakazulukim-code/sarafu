import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Globe2, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function GoogleConsoleVerification() {
    const [verificationCode, setVerificationCode] = useState('');
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        fetchVerificationCode();
    }, []);

    const fetchVerificationCode = async () => {
        try {
            setLoading(true);
            // Fetch from site_settings table
            const { data, error } = await supabase
                .from('site_settings')
                .select('id, google_verification_code')
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSettingsId(data.id);
                if (data.google_verification_code) {
                    setVerificationCode(data.google_verification_code);
                    setIsVerified(true);
                }
            }
        } catch (error: any) {
            console.error('Error fetching verification code:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!verificationCode.trim()) {
            toast.error('Please enter a verification code');
            return;
        }

        if (!settingsId) {
            toast.error('Site settings not found. Please contact support.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('site_settings')
                .update({
                    google_verification_code: verificationCode.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', settingsId);

            if (error) throw error;

            setIsVerified(true);
            toast.success('Google verification code saved!');
        } catch (error: any) {
            console.error('Error saving verification code:', error);
            toast.error(error.message || 'Failed to save verification code');
        } finally {
            setSaving(false);
        }
    };

    const copyMetaTag = () => {
        const metaTag = `<meta name="google-site-verification" content="${verificationCode}" />`;
        navigator.clipboard.writeText(metaTag);
        toast.success('Meta tag copied to clipboard!');
    };

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5" />
                    Google Search Console Verification
                    {isVerified && (
                        <Badge variant="default" className="bg-success/20 text-success ml-auto">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                            <p className="text-sm font-semibold">How to verify your site:</p>
                            <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                                <li>
                                    Go to{' '}
                                    <a
                                        href="https://search.google.com/search-console"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                        Google Search Console
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </li>
                                <li>Add your website URL and select "HTML tag" verification method</li>
                                <li>Copy just the <strong>content</strong> value from the meta tag</li>
                                <li>Paste it below and save</li>
                                <li>Go back to Google Search Console and click "Verify"</li>
                            </ol>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="verification_code">Verification Code</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="verification_code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    placeholder="e.g., abc123xyz..."
                                    className="font-mono text-sm"
                                />
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || !verificationCode.trim()}
                                    variant="hero"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Example: If Google gives you{' '}
                                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                                    &lt;meta name="google-site-verification" content="abc123xyz" /&gt;
                                </code>
                                <br />
                                Just paste: <code className="bg-muted px-1 py-0.5 rounded text-xs">abc123xyz</code>
                            </p>
                        </div>

                        {verificationCode && (
                            <div className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-success">Meta Tag (for reference)</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={copyMetaTag}
                                        className="h-7 text-xs gap-1"
                                    >
                                        <Copy className="h-3 w-3" />
                                        Copy
                                    </Button>
                                </div>
                                <code className="block text-xs bg-muted/50 p-2 rounded font-mono break-all">
                                    &lt;meta name="google-site-verification" content="{verificationCode}" /&gt;
                                </code>
                                <p className="text-xs text-muted-foreground">
                                    ✅ This tag is automatically added to your site's &lt;head&gt;
                                </p>
                            </div>
                        )}

                        <div className="pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">
                                <strong>Note:</strong> After saving, allow a few minutes for the changes to propagate,
                                then verify in Google Search Console. You may need to clear your browser cache.
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
