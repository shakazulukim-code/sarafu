import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, Coins, DollarSign, TrendingUp, TrendingDown, Lock, Unlock, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CoinData {
    id: string;
    name: string;
    symbol: string;
    price: number;
    market_cap: number;
    circulating_supply: number;
    creator_id: string;
    use_price_override: boolean;
    price_override: number | null;
    use_market_cap_override: boolean;
    market_cap_override: number | null;
    use_price_24h_change_override: boolean;
    price_24h_change_override: number | null;
    use_volume_24h_override: boolean;
    volume_24h_override: number | null;
}

export function EnhancedCoinDataManagement({ userId }: { userId: string }) {
    const [coins, setCoins] = useState<CoinData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null);
    const [showOverrideDialog, setShowOverrideDialog] = useState(false);
    const [saving, setSaving] = useState(false);

    // Override form state
    const [overrides, setOverrides] = useState({
        use_price: false,
        price: '',
        use_market_cap: false,
        market_cap: '',
        use_price_24h_change: false,
        price_24h_change: '',
        use_volume_24h: false,
        volume_24h: '',
    });

    useEffect(() => {
        fetchCoins();
    }, []);

    const fetchCoins = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('coins')
                .select('*')
                .eq('creator_id', userId)
                .eq('creation_fee_paid', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCoins(data || []);
        } catch (error: any) {
            console.error('Error fetching coins:', error);
            toast.error('Failed to fetch coins');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenOverrideDialog = (coin: CoinData) => {
        setSelectedCoin(coin);
        setOverrides({
            use_price: coin.use_price_override,
            price: coin.price_override?.toString() || coin.price.toString(),
            use_market_cap: coin.use_market_cap_override || false,
            market_cap: coin.market_cap_override?.toString() || coin.market_cap.toString(),
            use_price_24h_change: coin.use_price_24h_change_override || false,
            price_24h_change: coin.price_24h_change_override?.toString() || '0',
            use_volume_24h: coin.use_volume_24h_override || false,
            volume_24h: coin.volume_24h_override?.toString() || '0',
        });
        setShowOverrideDialog(true);
    };

    const handleSaveOverrides = async () => {
        if (!selectedCoin) return;

        setSaving(true);
        try {
            const updates: any = {
                updated_at: new Date().toISOString(),
            };

            // Price override
            if (overrides.use_price) {
                const price = parseFloat(overrides.price);
                if (price <= 0) {
                    toast.error('Price must be greater than 0');
                    return;
                }
                updates.use_price_override = true;
                updates.price_override = price;
            } else {
                updates.use_price_override = false;
            }

            // Market cap override
            if (overrides.use_market_cap) {
                const marketCap = parseFloat(overrides.market_cap);
                if (marketCap < 0) {
                    toast.error('Market cap cannot be negative');
                    return;
                }
                updates.use_market_cap_override = true;
                updates.market_cap_override = marketCap;
            } else {
                updates.use_market_cap_override = false;
            }

            // 24h price change override
            if (overrides.use_price_24h_change) {
                const change = parseFloat(overrides.price_24h_change);
                updates.use_price_24h_change_override = true;
                updates.price_24h_change_override = change;
            } else {
                updates.use_price_24h_change_override = false;
            }

            // 24h volume override
            if (overrides.use_volume_24h) {
                const volume = parseFloat(overrides.volume_24h);
                if (volume < 0) {
                    toast.error('Volume cannot be negative');
                    return;
                }
                updates.use_volume_24h_override = true;
                updates.volume_24h_override = volume;
            } else {
                updates.use_volume_24h_override = false;
            }

            const { error } = await supabase
                .from('coins')
                .update(updates)
                .eq('id', selectedCoin.id);

            if (error) throw error;

            toast.success('Coin data overrides updated successfully!');
            setShowOverrideDialog(false);
            fetchCoins();
        } catch (error: any) {
            console.error('Error:', error);
            toast.error(error.message || 'Failed to update overrides');
        } finally {
            setSaving(false);
        }
    };

    const getActiveOverridesCount = (coin: CoinData) => {
        let count = 0;
        if (coin.use_price_override) count++;
        if (coin.use_market_cap_override) count++;
        if (coin.use_price_24h_change_override) count++;
        if (coin.use_volume_24h_override) count++;
        return count;
    };

    return (
        <>
            <div className="space-y-4">
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Coins className="h-5 w-5" />
                            Your Coins - Data Management
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : coins.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                You have no paid creation coins yet
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {coins.map((coin) => {
                                    const overrideCount = getActiveOverridesCount(coin);
                                    return (
                                        <motion.div
                                            key={coin.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-all space-y-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm truncate">{coin.name}</h4>
                                                    <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                                                </div>
                                                {overrideCount > 0 && (
                                                    <Badge variant="outline" className="text-xs bg-primary/10">
                                                        <Lock className="h-3 w-3 mr-1" />
                                                        {overrideCount} override{overrideCount > 1 ? 's' : ''}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground flex items-center gap-1">
                                                        <DollarSign className="h-3 w-3" />
                                                        Price
                                                    </p>
                                                    <p className={`font-mono font-bold ${coin.use_price_override ? 'text-primary' : ''}`}>
                                                        KES {(coin.use_price_override ? coin.price_override : coin.price)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>

                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground flex items-center gap-1">
                                                        <BarChart3 className="h-3 w-3" />
                                                        Market Cap
                                                    </p>
                                                    <p className={`font-mono text-xs ${coin.use_market_cap_override ? 'text-primary' : ''}`}>
                                                        KES {(coin.use_market_cap_override ? coin.market_cap_override : coin.market_cap)?.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant="hero"
                                                className="w-full gap-1"
                                                onClick={() => handleOpenOverrideDialog(coin)}
                                            >
                                                {overrideCount > 0 ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                                Manage Overrides
                                            </Button>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="glass-card border-info/30 bg-info/5">
                    <CardContent className="pt-6">
                        <p className="text-sm font-semibold text-info mb-2">About Data Overrides</p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• Enable overrides to manually control coin data displayed to users</li>
                            <li>• When disabled, data follows market-driven calculations</li>
                            <li>• All changes are logged for transparency and audit purposes</li>
                            <li>• Use responsibly to maintain trust in your coin</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {/* Override Dialog */}
            <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
                <DialogContent className="glass-card border-border/50 max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Data Overrides - {selectedCoin?.name}</DialogTitle>
                    </DialogHeader>

                    {selectedCoin && (
                        <Tabs defaultValue="price" className="space-y-4">
                            <TabsList className="grid grid-cols-4">
                                <TabsTrigger value="price">Price</TabsTrigger>
                                <TabsTrigger value="market-cap">Market Cap</TabsTrigger>
                                <TabsTrigger value="change">24h Change</TabsTrigger>
                                <TabsTrigger value="volume">24h Volume</TabsTrigger>
                            </TabsList>

                            {/* Price Override */}
                            <TabsContent value="price" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="use-price-override">Enable Price Override</Label>
                                    <Switch
                                        id="use-price-override"
                                        checked={overrides.use_price}
                                        onCheckedChange={(checked) => setOverrides({ ...overrides, use_price: checked })}
                                    />
                                </div>
                                {overrides.use_price && (
                                    <div className="space-y-2">
                                        <Label>Override Price (KES)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={overrides.price}
                                            onChange={(e) => setOverrides({ ...overrides, price: e.target.value })}
                                            className=" font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Current: KES {selectedCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Market Cap Override */}
                            <TabsContent value="market-cap" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="use-marketcap-override">Enable Market Cap Override</Label>
                                    <Switch
                                        id="use-marketcap-override"
                                        checked={overrides.use_market_cap}
                                        onCheckedChange={(checked) => setOverrides({ ...overrides, use_market_cap: checked })}
                                    />
                                </div>
                                {overrides.use_market_cap && (
                                    <div className="space-y-2">
                                        <Label>Override Market Cap (KES)</Label>
                                        <Input
                                            type="number"
                                            step="1"
                                            value={overrides.market_cap}
                                            onChange={(e) => setOverrides({ ...overrides, market_cap: e.target.value })}
                                            className="font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Current: KES {selectedCoin.market_cap?.toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* 24h Change Override */}
                            <TabsContent value="change" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="use-change-override">Enable 24h Change Override</Label>
                                    <Switch
                                        id="use-change-override"
                                        checked={overrides.use_price_24h_change}
                                        onCheckedChange={(checked) => setOverrides({ ...overrides, use_price_24h_change: checked })}
                                    />
                                </div>
                                {overrides.use_price_24h_change && (
                                    <div className="space-y-2">
                                        <Label>Override 24h Change (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={overrides.price_24h_change}
                                            onChange={(e) => setOverrides({ ...overrides, price_24h_change: e.target.value })}
                                            className="font-mono"
                                            placeholder="e.g., 5.2 or -3.1"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter percentage change (positive or negative)
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Volume Override */}
                            <TabsContent value="volume" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="use-volume-override">Enable 24h Volume Override</Label>
                                    <Switch
                                        id="use-volume-override"
                                        checked={overrides.use_volume_24h}
                                        onCheckedChange={(checked) => setOverrides({ ...overrides, use_volume_24h: checked })}
                                    />
                                </div>
                                {overrides.use_volume_24h && (
                                    <div className="space-y-2">
                                        <Label>Override 24h Volume (KES)</Label>
                                        <Input
                                            type="number"
                                            step="1"
                                            value={overrides.volume_24h}
                                            onChange={(e) => setOverrides({ ...overrides, volume_24h: e.target.value })}
                                            className="font-mono"
                                        />
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowOverrideDialog(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="hero"
                            onClick={handleSaveOverrides}
                            disabled={saving}
                            className="flex-1 gap-2"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save Overrides</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
