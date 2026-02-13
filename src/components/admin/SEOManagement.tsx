import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Edit, Plus, Trash2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GoogleConsoleVerification } from './GoogleConsoleVerification';

interface SEOSettings {
    id?: string;
    page_path: string;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string[];
    og_title?: string;
    og_description?: string;
    og_image?: string;
    twitter_title?: string;
    twitter_description?: string;
    twitter_image?: string;
    canonical_url?: string;
    robots_meta?: string;
    structured_data?: any;
    is_active: boolean;
}

export function SEOManagement() {
    const [settings, setSettings] = useState<SEOSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<SEOSettings | null>(null);

    // Form state
    const [formData, setFormData] = useState<SEOSettings>({
        page_path: '',
        meta_title: '',
        meta_description: '',
        meta_keywords: [],
        og_title: '',
        og_description: '',
        og_image: '',
        twitter_title: '',
        twitter_description: '',
        twitter_image: '',
        canonical_url: '',
        robots_meta: 'index,follow',
        is_active: true,
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('seo_settings')
                .select('*')
                .order('page_path');

            if (error) throw error;
            setSettings(data || []);
        } catch (error: any) {
            console.error('Error fetching SEO settings:', error);
            toast.error('Failed to load SEO settings');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (item?: SEOSettings) => {
        if (item) {
            setEditingItem(item);
            setFormData(item);
        } else {
            setEditingItem(null);
            setFormData({
                page_path: '',
                meta_title: '',
                meta_description: '',
                meta_keywords: [],
                og_title: '',
                og_description: '',
                og_image: '',
                twitter_title: '',
                twitter_description: '',
                twitter_image: '',
                canonical_url: '',
                robots_meta: 'index,follow',
                is_active: true,
            });
        }
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (!formData.page_path.trim()) {
            toast.error('Page path is required');
            return;
        }

        setSaving(true);
        try {
            if (editingItem?.id) {
                // Update existing
                const { error } = await supabase
                    .from('seo_settings')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingItem.id);

                if (error) throw error;
                toast.success('SEO settings updated!');
            } else {
                // Create new
                const { error } = await supabase
                    .from('seo_settings')
                    .insert([formData]);

                if (error) throw error;
                toast.success('SEO settings created!');
            }

            setShowDialog(false);
            fetchSettings();
        } catch (error: any) {
            console.error('Error saving SEO settings:', error);
            toast.error(error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this SEO configuration?')) return;

        try {
            const { error } = await supabase
                .from('seo_settings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('SEO settings deleted');
            fetchSettings();
        } catch (error: any) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete settings');
        }
    };

    const handleKeywordsChange = (value: string) => {
        const keywords = value.split(',').map(k => k.trim()).filter(k => k);
        setFormData({ ...formData, meta_keywords: keywords });
    };

    return (
        <>
            {/* Google Console Verification */}
            <GoogleConsoleVerification />

            <Card className="glass-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            SEO Settings Management
                        </CardTitle>
                        <Button onClick={() => handleOpenDialog()} variant="hero" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add Page SEO
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : settings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No SEO settings configured yet
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {settings.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Globe className="h-4 w-4 text-muted-foreground" />
                                                <code className="text-sm font-mono font-semibold">{item.page_path}</code>
                                                {!item.is_active && (
                                                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                                                )}
                                            </div>

                                            <p className="text-sm font-medium mb-1">{item.meta_title || 'No title set'}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {item.meta_description || 'No description set'}
                                            </p>

                                            {item.meta_keywords && item.meta_keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {item.meta_keywords.slice(0, 5).map((keyword, i) => (
                                                        <Badge key={i} variant="secondary" className="text-xs">
                                                            {keyword}
                                                        </Badge>
                                                    ))}
                                                    {item.meta_keywords.length > 5 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            +{item.meta_keywords.length - 5} more
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleOpenDialog(item)}
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(item.id!)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit/Create Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="glass-card border-border/50 max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Edit SEO Settings' : 'Add SEO Settings'}
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="basic" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="basic">Basic</TabsTrigger>
                            <TabsTrigger value="social">Social Media</TabsTrigger>
                            <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        </TabsList>

                        {/* Basic Tab */}
                        <TabsContent value="basic" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="page_path">Page Path *</Label>
                                <Input
                                    id="page_path"
                                    value={formData.page_path}
                                    onChange={(e) => setFormData({ ...formData, page_path: e.target.value })}
                                    placeholder="/about or /coin/:id"
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use :id for dynamic routes (e.g., /coin/:id)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="meta_title">Meta Title</Label>
                                <Input
                                    id="meta_title"
                                    value={formData.meta_title || ''}
                                    onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                                    placeholder="Page Title - Sarafu Mpya"
                                    maxLength={60}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {formData.meta_title?.length || 0}/60 characters (optimal: 50-60)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="meta_description">Meta Description</Label>
                                <Textarea
                                    id="meta_description"
                                    value={formData.meta_description || ''}
                                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                                    placeholder="Brief description of the page..."
                                    rows={3}
                                    maxLength={160}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {formData.meta_description?.length || 0}/160 characters (optimal: 120-160)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="meta_keywords">Keywords (comma-separated)</Label>
                                <Input
                                    id="meta_keywords"
                                    value={formData.meta_keywords?.join(', ') || ''}
                                    onChange={(e) => handleKeywordsChange(e.target.value)}
                                    placeholder="crypto, Kenya, M-PESA, blockchain"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="is_active">Active</Label>
                                <Switch
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                            </div>
                        </TabsContent>

                        {/* Social Media Tab */}
                        <TabsContent value="social" className="space-y-4">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">OpenGraph (Facebook, LinkedIn)</h4>

                                <div className="space-y-2">
                                    <Label htmlFor="og_title">OG Title</Label>
                                    <Input
                                        id="og_title"
                                        value={formData.og_title || ''}
                                        onChange={(e) => setFormData({ ...formData, og_title: e.target.value })}
                                        placeholder="Leave empty to use Meta Title"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="og_description">OG Description</Label>
                                    <Textarea
                                        id="og_description"
                                        value={formData.og_description || ''}
                                        onChange={(e) => setFormData({ ...formData, og_description: e.target.value })}
                                        placeholder="Leave empty to use Meta Description"
                                        rows={2}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="og_image">OG Image URL</Label>
                                    <Input
                                        id="og_image"
                                        value={formData.og_image || ''}
                                        onChange={(e) => setFormData({ ...formData, og_image: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4 space-y-3">
                                <h4 className="font-semibold text-sm">Twitter Card</h4>

                                <div className="space-y-2">
                                    <Label htmlFor="twitter_title">Twitter Title</Label>
                                    <Input
                                        id="twitter_title"
                                        value={formData.twitter_title || ''}
                                        onChange={(e) => setFormData({ ...formData, twitter_title: e.target.value })}
                                        placeholder="Leave empty to use OG Title"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="twitter_description">Twitter Description</Label>
                                    <Textarea
                                        id="twitter_description"
                                        value={formData.twitter_description || ''}
                                        onChange={(e) => setFormData({ ...formData, twitter_description: e.target.value })}
                                        placeholder="Leave empty to use OG Description"
                                        rows={2}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="twitter_image">Twitter Image URL</Label>
                                    <Input
                                        id="twitter_image"
                                        value={formData.twitter_image || ''}
                                        onChange={(e) => setFormData({ ...formData, twitter_image: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Advanced Tab */}
                        <TabsContent value="advanced" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="canonical_url">Canonical URL</Label>
                                <Input
                                    id="canonical_url"
                                    value={formData.canonical_url || ''}
                                    onChange={(e) => setFormData({ ...formData, canonical_url: e.target.value })}
                                    placeholder="Leave empty for auto-generated"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Full URL for canonical reference (prevents duplicate content)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="robots_meta">Robots Meta</Label>
                                <Input
                                    id="robots_meta"
                                    value={formData.robots_meta || ''}
                                    onChange={(e) => setFormData({ ...formData, robots_meta: e.target.value })}
                                    placeholder="index,follow"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Options: index,follow / noindex,nofollow / noindex,follow
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="hero"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 gap-2"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
