import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Coins, Lock, DollarSign, Info, AlertCircle, CheckCircle, Plus, Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreatorCoin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  creation_fee_paid: boolean;
  approval_status: string;
  is_approved: boolean;
  creator_id: string;
  circulating_supply: number;
  market_cap: number;
  use_price_override: boolean;
  price_override: number | null;
}

interface AdminCoin extends CreatorCoin {
  isOwnCoin: boolean;
}

export function CoinPriceManagement({ userId }: { userId: string }) {
  const [coins, setCoins] = useState<AdminCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<AdminCoin | null>(null);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [priceProcessing, setPriceProcessing] = useState(false);
  const [filter, setFilter] = useState<'own' | 'all'>('own');

  useEffect(() => {
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coins')
        .select('*')
        .eq('creation_fee_paid', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const adminCoins = (data || []).map(coin => ({
        ...coin,
        isOwnCoin: coin.creator_id === userId,
      })) as AdminCoin[];

      setCoins(adminCoins);
    } catch (error: any) {
      console.error('Error fetching coins:', error);
      toast.error('Failed to fetch coins');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPriceDialog = (coin: AdminCoin) => {
    setSelectedCoin(coin);
    setNewPrice(coin.price_override?.toString() || coin.price.toString());
    setShowPriceDialog(true);
  };

  const handleSavePrice = async () => {
    if (!selectedCoin || !newPrice) {
      toast.error('Enter a valid price');
      return;
    }

    const price = parseFloat(newPrice);
    if (price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setPriceProcessing(true);
    try {
      const { error } = await supabase
        .from('coins')
        .update({
          price_override: price,
          use_price_override: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCoin.id);

      if (error) throw error;

      toast.success(`Price updated! KES ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
      setShowPriceDialog(false);
      setSelectedCoin(null);
      fetchCoins();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to update price');
    } finally {
      setPriceProcessing(false);
    }
  };

  const handleRemoveOverride = async (coin: AdminCoin) => {
    if (!confirm(`Remove price override for ${coin.name}? Market price will apply.`)) return;

    try {
      const { error } = await supabase
        .from('coins')
        .update({
          use_price_override: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', coin.id);

      if (error) throw error;

      toast.success('Price override removed');
      fetchCoins();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to remove price override');
    }
  };

  const displayCoins = filter === 'own'
    ? coins.filter(c => c.isOwnCoin)
    : coins;

  return (
    <>
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Paid Creation Coins
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'own' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('own')}
                >
                  My Coins
                </Button>
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All Coins
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : displayCoins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {filter === 'own'
                  ? 'You have no paid creation coins yet'
                  : 'No paid creation coins found'}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayCoins.map((coin) => (
                  <motion.div
                    key={coin.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{coin.name}</h4>
                        <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                      </div>
                      {coin.isOwnCoin && (
                        <Badge variant="outline" className="text-xs">
                          Yours
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Current Price
                        </p>
                        <p className="text-sm font-mono font-bold">
                          KES {coin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Market Cap</p>
                        <p className="text-sm font-mono">
                          KES {(coin.market_cap || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </p>
                      </div>

                      {coin.use_price_override && coin.price_override && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-2 rounded bg-primary/10 border border-primary/30"
                        >
                          <p className="text-xs font-semibold text-primary flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Admin Set Price
                          </p>
                          <p className="text-sm font-mono font-bold text-primary">
                            KES {coin.price_override.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {coin.isOwnCoin && (
                        <Button
                          size="sm"
                          variant="hero"
                          className="flex-1 gap-1"
                          onClick={() => handleOpenPriceDialog(coin)}
                        >
                          <DollarSign className="h-3 w-3" />
                          Set Price
                        </Button>
                      )}
                      {coin.use_price_override && coin.isOwnCoin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveOverride(coin)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {!coin.isOwnCoin && (
                      <div className="mt-3 p-2 rounded bg-info/10 border border-info/30">
                        <p className="text-xs text-info flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Market-driven pricing
                        </p>
                      </div>
                    )}

                    {coin.approval_status !== 'approved' && (
                      <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/30">
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {coin.approval_status || 'Pending approval'}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="glass-card border-info/30 bg-info/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2 text-info">
                <Info className="h-4 w-4" />
                Price Management
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• <span className="font-semibold text-foreground">Your coins:</span> Set custom prices anytime</li>
                <li>• <span className="font-semibold text-foreground">Other coins:</span> Prices are market-driven based on trading activity</li>
                <li>• When you enable price override, that fixed price applies to all buyers</li>
                <li>• Remove override to return to market-driven pricing</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="glass-card border-border/50 max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Set Price for {selectedCoin?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedCoin && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Current Market Price</p>
                <p className="text-lg font-bold font-mono">
                  KES {selectedCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>New Price (KES)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.001"
                  placeholder="Enter price"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-muted/30 h-12 font-mono text-lg"
                />
              </div>

              {newPrice && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-success/10 border border-success/30">
                  <div className="flex items-center gap-2 text-success font-semibold text-sm">
                    <CheckCircle className="h-4 w-4" />
                    New Price: KES {parseFloat(newPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPriceDialog(false)}
                  disabled={priceProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  onClick={handleSavePrice}
                  disabled={priceProcessing || !newPrice}
                  className="flex-1 gap-2"
                >
                  {priceProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save Price</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
