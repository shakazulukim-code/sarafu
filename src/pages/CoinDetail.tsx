import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TradingChart } from '@/components/trading/TradingChart';
import { OrderBook } from '@/components/trading/OrderBook';
import { TradeHistory } from '@/components/trading/TradeHistory';
import { TradingPanel } from '@/components/trading/TradingPanel';
import { CoinInfo } from '@/components/trading/CoinInfo';
import { MpesaPaymentModal } from '@/components/trading/MpesaPaymentModal';
import { CoinContractInfo } from '@/components/coins/CoinContractInfo';
import { CoinMetrics } from '@/components/coins/CoinMetrics';
import { CoinPriceTrend } from '@/components/coins/CoinPriceTrend';
import { ArrowLeft, Loader2, AlertCircle, ArrowDown, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getEffectivePrice } from '@/lib/utils';

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  price: number;
  initial_price: number;
  market_cap: number | null;
  liquidity: number;
  holders_count: number;
  volatility: number;
  total_supply: number;
  circulating_supply: number;
  burned_supply?: number;
  is_trending: boolean;
  is_featured: boolean;
  trading_paused: boolean;
  logo_url: string | null;
  whitepaper_url: string | null;
  contract_address?: string | null;
  use_price_override?: boolean;
  price_override?: number | null;
}

interface SiteSettings {
  min_buy_amount: number;
  max_buy_amount: number;
  fee_percentage: number;
  admin_commission: number;
}

type PaymentStatus = 'waiting' | 'success' | 'failed' | 'timeout';

export default function CoinDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tradingPanelRef = useRef<HTMLDivElement>(null);
  const [coin, setCoin] = useState<CoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('waiting');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [userHolding, setUserHolding] = useState<number>(0);
  const [userFiatBalance, setUserFiatBalance] = useState<number>(0);
  const [settings, setSettings] = useState<SiteSettings>({
    min_buy_amount: 100,
    max_buy_amount: 100000,
    fee_percentage: 2.5,
    admin_commission: 2.5,
  });
  const [processing, setProcessing] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chart' | 'orderbook' | 'trades'>('chart');
  const [pendingBuyAmount, setPendingBuyAmount] = useState(0);

  const effectivePrice = coin ? getEffectivePrice(coin) : 0;
  const priceMultiplier = coin && coin.initial_price > 0 ? effectivePrice / coin.initial_price : 1;

  useEffect(() => { if (id) fetchData(); }, [id]);
  useEffect(() => { if (user && coin) fetchUserData(); }, [user, coin]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && tradingPanelRef.current && !loading) {
      setTimeout(() => {
        tradingPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [searchParams, loading, coin]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`coin-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'coins', filter: `id=eq.${id}` },
        (payload) => { setCoin(payload.new as CoinData); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Real-time subscription for user holdings updates
  useEffect(() => {
    if (!user || !coin) return;

    const channel = supabase
      .channel(`holdings-${user.id}-${coin.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'holdings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            const newData = payload.new as any;
            if (newData.coin_id === coin.id) {
              setUserHolding(newData.amount || 0);
            }
          } else if (payload.old) {
            // Deleted on sell all
            const oldData = payload.old as any;
            if (oldData.coin_id === coin.id) {
              setUserHolding(0);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, coin]);

  // Real-time subscription for wallet balance updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.fiat_balance !== undefined) {
            setUserFiatBalance(newData.fiat_balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coinResult, settingsResult] = await Promise.all([
        supabase.from('coins').select('*').eq('id', id).maybeSingle(),
        supabase.from('site_settings').select('min_buy_amount, max_buy_amount, fee_percentage, admin_commission').maybeSingle(),
      ]);
      if (coinResult.error) throw coinResult.error;
      if (!coinResult.data) { navigate('/launchpad'); return; }
      setCoin(coinResult.data as CoinData);
      if (settingsResult.data) setSettings(settingsResult.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      navigate('/launchpad');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (!user || !coin) return;
    const [holdingRes, walletRes] = await Promise.all([
      supabase.from('holdings').select('amount').eq('user_id', user.id).eq('coin_id', coin.id).maybeSingle(),
      supabase.from('wallets').select('fiat_balance').eq('user_id', user.id).maybeSingle(),
    ]);
    if (holdingRes.data) setUserHolding(holdingRes.data.amount);
    if (walletRes.data) setUserFiatBalance(walletRes.data.fiat_balance);
  };

  const scrollToTrading = () => {
    tradingPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBuy = async (amount: number, phone: string, useWallet: boolean, skipBalanceCheck = false) => {
    if (!user || !coin) { toast.error('Please sign in to buy coins'); return; }

    const totalValue = amount * effectivePrice;
    const fee = totalValue * (settings.fee_percentage / 100);
    const totalWithFee = totalValue + fee;

    setProcessing(true);
    try {
      if (useWallet) {
        if (!skipBalanceCheck && totalWithFee > userFiatBalance) { toast.error('Insufficient wallet balance'); setProcessing(false); return; }

        const { error: buyError } = await supabase.rpc('process_wallet_buy', {
          p_user_id: user.id,
          p_coin_id: coin.id,
          p_amount: amount,
        });
        if (buyError) throw buyError;

        toast.success('Purchase successful! Coins added to your portfolio.');
        fetchUserData();
        fetchData();
      } else {
        let formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
        if (!formattedPhone || formattedPhone.length < 9) { toast.error('Please enter a valid phone number'); setProcessing(false); return; }

        // Create a deposit transaction to fund wallet with totalWithFee
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            coin_id: coin.id,
            type: 'deposit',
            amount: totalWithFee,
            price_per_coin: 0,
            total_value: totalWithFee,
            phone: formattedPhone,
            status: 'pending',
          })
          .select().single();
        if (txError) throw txError;

        setCurrentTransactionId(transaction.id);
        setPendingBuyAmount(amount);
        setPaymentStatus('waiting');
        setShowPaymentModal(true);

        const { data: stkData, error: stkError } = await supabase.functions.invoke('mpesa-stk-push', {
          body: { phone: formattedPhone, amount: Math.round(totalWithFee), transactionId: transaction.id, accountReference: `DEPOSIT-${user.id}`, type: 'deposit' },
        });

        if (stkError) {
          console.error('STK push error:', stkError);
          setPaymentStatus('failed');
          return;
        }

        // Check if function returned error in body
        if (stkData && !stkData.success) {
          console.error('STK push failed:', stkData.error);
          setPaymentStatus('failed');
          return;
        }

        toast.success('Check your phone for M-PESA prompt!');

        // Update transaction with CheckoutRequestID immediately
        if (stkData?.checkoutRequestId) {
          console.log('📌 Storing CheckoutRequestID:', stkData.checkoutRequestId);
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              checkout_request_id: stkData.checkoutRequestId,
              status: 'stk_sent',
            })
            .eq('id', transaction.id);

          if (updateError) {
            console.error('Failed to update transaction with CheckoutRequestID:', updateError);
          } else {
            console.log('✅ Transaction updated with CheckoutRequestID');
          }
        }

        // Start polling deposit; on success, refresh wallet then auto-complete buy from wallet
        startPolling(transaction.id, amount);
      }
    } catch (error: any) {
      console.error('Buy error:', error);
      toast.error(error.message || 'Failed to process transaction');
      setPaymentStatus('failed');
    } finally {
      setProcessing(false);
    }
  };

  const autoWalletBuy = async (amount: number, retries = 6) => {
    if (!user || !coin) return;
    const { error } = await supabase.rpc('process_wallet_buy', {
      p_user_id: user.id,
      p_coin_id: coin.id,
      p_amount: amount,
    });

    if (error) {
      const message = error.message || 'Failed to complete purchase';
      if (message.toLowerCase().includes('insufficient wallet balance') && retries > 0) {
        setTimeout(() => autoWalletBuy(amount, retries - 1), 2000);
        return;
      }
      toast.error(message);
      return;
    }

    toast.success('Purchase successful! Coins added to your portfolio.');
    fetchUserData();
    fetchData();
  };

  const handleSell = async (amount: number, toWallet: boolean) => {
    if (!user || !coin) { toast.error('Please sign in to sell coins'); return; }
    if (amount > userHolding) { toast.error('Insufficient balance'); return; }

    setProcessing(true);
    try {
      const totalValue = amount * effectivePrice;
      const fee = totalValue * (settings.fee_percentage / 100);
      const netValue = totalValue - fee;

      if (toWallet) {
        const { error: sellError } = await supabase.rpc('process_wallet_sell', {
          p_user_id: user.id,
          p_coin_id: coin.id,
          p_amount: amount,
        });
        if (sellError) throw sellError;
        toast.success(`Sold! KES ${netValue.toLocaleString()} added to your wallet.`);
      } else {
        const { data: transaction, error } = await supabase
          .from('transactions')
          .insert({ user_id: user.id, coin_id: coin.id, type: 'sell', amount, price_per_coin: effectivePrice, total_value: totalValue, status: 'completed' })
          .select().single();
        if (error) throw error;

        await supabase.from('commission_transactions').insert({ transaction_id: transaction.id, amount: fee, commission_rate: settings.fee_percentage });
        toast.success('Sell order placed! Funds will be sent to your M-PESA.');
      }

      fetchUserData();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process transaction');
    } finally {
      setProcessing(false);
    }
  };

  const startPolling = (transactionId: string, buyAmount: number) => {
    let attempts = 0;
    const maxAttempts = 45; // 90 seconds with 2-second intervals
    let timeoutId: NodeJS.Timeout | null = null;
    let channelSubscribed = false;
    let checkoutRequestId: string | null = null;

    // Subscribe to real-time transaction updates
    const channel = supabase
      .channel(`transaction-${transactionId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${transactionId}` },
        (payload: any) => {
          const txStatus = payload.new.status;
          const errorMsg = payload.new.error_reason;
          console.log('🔄 Real-time update received:', { status: txStatus, error: errorMsg });
          
          if (txStatus === 'completed') {
            console.log('✅ Payment completed via real-time!');
            setPaymentStatus('success');
            if (timeoutId) clearTimeout(timeoutId);
            if (channelSubscribed) supabase.removeChannel(channel);
            // Refresh wallet and execute wallet-based buy automatically after deposit completion
            fetchUserData().then(async () => {
              await autoWalletBuy(buyAmount);
            });
          } else if (txStatus === 'cancelled' || txStatus === 'failed') {
            console.log('❌ Payment cancelled/failed via real-time:', errorMsg);
            setPaymentStatus('failed');
            if (timeoutId) clearTimeout(timeoutId);
            if (channelSubscribed) supabase.removeChannel(channel);
            if (errorMsg) toast.error(errorMsg);
          }
        }
      )
      .subscribe(() => {
        channelSubscribed = true;
        console.log('📡 Subscribed to transaction real-time updates');
      });

    // Get initial CheckoutRequestID from transaction
    const getCheckoutRequestId = async () => {
      try {
        const { data: tx } = await supabase
          .from('transactions')
          .select('checkout_request_id')
          .eq('id', transactionId)
          .single();
        return tx?.checkout_request_id || null;
      } catch (err) {
        console.error('Error getting CheckoutRequestID:', err);
        return null;
      }
    };

    // Query M-PESA status via Supabase function
    const pollMpesaStatus = async () => {
      attempts++;
      try {
        // Get CheckoutRequestID if we don't have it yet
        if (!checkoutRequestId) {
          checkoutRequestId = await getCheckoutRequestId();
          if (!checkoutRequestId) {
            console.log(`⏱️ Poll ${attempts}/45: Waiting for CheckoutRequestID...`);
            if (attempts < maxAttempts) {
              setTimeout(pollMpesaStatus, 2000);
            } else {
              console.log('⏰ Max attempts reached, setting timeout');
              setPaymentStatus('timeout');
              if (timeoutId) clearTimeout(timeoutId);
              if (channelSubscribed) supabase.removeChannel(channel);
            }
            return;
          }
        }

        // Query M-PESA status via our Supabase function
        console.log(`⏱️ Poll ${attempts}/45: Querying M-PESA status for ${checkoutRequestId.substring(0, 8)}...`);
        
        const { data: result, error: funcError } = await supabase.functions.invoke('query-mpesa-status', {
          body: { transactionId, checkoutRequestId },
        });

        if (funcError) {
          console.error('❌ Function error:', funcError);
          if (attempts < maxAttempts) {
            setTimeout(pollMpesaStatus, 2000);
          } else {
            setPaymentStatus('timeout');
            if (timeoutId) clearTimeout(timeoutId);
            if (channelSubscribed) supabase.removeChannel(channel);
          }
          return;
        }

        const { status: mpesaStatus, errorReason } = result || {};
        console.log(`📊 M-PESA response: status=${mpesaStatus}, error=${errorReason}`);

        if (mpesaStatus === 'completed') {
          console.log('✅ Payment completed via M-PESA query!');
          setPaymentStatus('success');
          if (timeoutId) clearTimeout(timeoutId);
          if (channelSubscribed) supabase.removeChannel(channel);
          // Refresh wallet and execute wallet-based buy automatically after deposit completion
          fetchUserData().then(async () => {
            await autoWalletBuy(buyAmount);
          });
        } else if (mpesaStatus === 'cancelled' || mpesaStatus === 'failed') {
          console.log('❌ Payment cancelled/failed via M-PESA query:', errorReason);
          setPaymentStatus('failed');
          if (timeoutId) clearTimeout(timeoutId);
          if (channelSubscribed) supabase.removeChannel(channel);
          if (errorReason) toast.error(errorReason);
        } else if (mpesaStatus === 'stk_sent' && attempts < maxAttempts) {
          // Still waiting for user to enter PIN
          console.log('⏳ STK prompt still showing, user may enter PIN');
          setTimeout(pollMpesaStatus, 2000);
        } else if (attempts >= maxAttempts) {
          console.log('⏰ Max poll attempts reached');
          setPaymentStatus('timeout');
          if (timeoutId) clearTimeout(timeoutId);
          if (channelSubscribed) supabase.removeChannel(channel);
        } else {
          setTimeout(pollMpesaStatus, 2000);
        }
      } catch (err) {
        console.error('❌ Polling error:', err);
        if (attempts >= maxAttempts) {
          setPaymentStatus('timeout');
          if (timeoutId) clearTimeout(timeoutId);
          if (channelSubscribed) supabase.removeChannel(channel);
        } else {
          setTimeout(pollMpesaStatus, 2000);
        }
      }
    };

    // Auto-timeout after 90 seconds
    timeoutId = setTimeout(() => {
      if (attempts < maxAttempts && paymentStatus === 'waiting') {
        console.warn('⏰ Payment timeout after 90 seconds');
        setPaymentStatus('timeout');
        if (channelSubscribed) supabase.removeChannel(channel);
      }
    }, 90000);

    // Start polling immediately
    console.log('🚀 Starting M-PESA polling...');
    pollMpesaStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!coin) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <main className="w-full max-w-7xl mx-auto pt-20 pb-24 lg:pb-8 px-3 sm:px-4 md:px-6">
        {/* Back + Multiplier */}
        <div className="flex items-center justify-between mb-4">
          <Link to="/launchpad" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Launchpad</span>
            <span className="sm:hidden">Back</span>
          </Link>
          {priceMultiplier > 1 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/30"
            >
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="font-bold text-success text-sm">{priceMultiplier.toFixed(2)}x</span>
            </motion.div>
          )}
        </div>

        {/* Trading Paused */}
        {coin.trading_paused && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <span className="text-warning font-medium text-sm">Trading is currently paused</span>
          </motion.div>
        )}

        {/* Mobile Buy Button */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <Button variant="hero" size="lg" className="w-full gap-2 shadow-xl" onClick={scrollToTrading}>
            <ArrowDown className="h-5 w-5" />
            Buy {coin.symbol}
          </Button>
        </div>

        {/* Contract Info */}
        {coin.contract_address && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <CoinContractInfo contractAddress={coin.contract_address} coinName={coin.name} coinSymbol={coin.symbol} coinId={coin.id} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Coin Metrics */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <CoinMetrics coinId={coin.id} />
        </motion.div>

        {/* Price Trend Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">24h Price Trend</h3>
              <span className="text-xs text-muted-foreground">Historical prices</span>
            </div>
            <div style={{ height: '80px' }}>
              <CoinPriceTrend coinId={coin.id} height={80} />
            </div>
          </Card>
        </motion.div>

        {/* Main Trading Layout */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left Column */}
          <div className="space-y-4 min-w-0">
            {/* Mobile: Tabbed Chart/OrderBook/Trades */}
            <div className="lg:hidden">
              <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="chart" className="text-xs">Chart</TabsTrigger>
                  <TabsTrigger value="orderbook" className="text-xs">Order Book</TabsTrigger>
                  <TabsTrigger value="trades" className="text-xs">Trades</TabsTrigger>
                </TabsList>
                <TabsContent value="chart">
                  <Card className="glass-card overflow-hidden">
                    <CardContent className="p-1 sm:p-2 h-[250px] sm:h-[280px]">
                      <TradingChart symbol={coin.symbol} currentPrice={effectivePrice} volatility={coin.volatility} />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="orderbook">
                  <Card className="glass-card overflow-hidden">
                    <CardContent className="p-1 sm:p-2 h-[280px] overflow-auto">
                      <OrderBook currentPrice={effectivePrice} symbol={coin.symbol} />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="trades">
                  <Card className="glass-card overflow-hidden">
                    <CardContent className="p-1 sm:p-2 h-[280px] overflow-auto">
                      <TradeHistory currentPrice={effectivePrice} symbol={coin.symbol} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop: Stacked layout */}
            <div className="hidden lg:block space-y-4">
              <Card className="glass-card overflow-hidden">
                <CardContent className="p-4 h-[450px]">
                  <TradingChart symbol={coin.symbol} currentPrice={effectivePrice} volatility={coin.volatility} />
                </CardContent>
              </Card>

              <div className="grid gap-4 grid-cols-2">
                <Card className="glass-card h-[400px] overflow-hidden">
                  <CardContent className="p-4 h-full overflow-auto">
                    <OrderBook currentPrice={effectivePrice} symbol={coin.symbol} />
                  </CardContent>
                </Card>
                <Card className="glass-card h-[400px] overflow-hidden">
                  <CardContent className="p-4 h-full overflow-auto">
                    <TradeHistory currentPrice={effectivePrice} symbol={coin.symbol} />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Coin Info */}
            <Card className="glass-card">
              <CardContent className="p-4 sm:p-6">
                <CoinInfo coin={coin} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Trading Panel */}
          <motion.div
            ref={tradingPanelRef}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:sticky lg:top-20 h-fit mb-20 lg:mb-0 min-w-0"
            id="trading-panel"
          >
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0 min-h-[500px]">
                <TradingPanel
                  symbol={coin.symbol}
                  currentPrice={effectivePrice}
                  userBalance={userHolding}
                  userFiatBalance={userFiatBalance}
                  minBuyAmount={settings.min_buy_amount}
                  maxBuyAmount={settings.max_buy_amount}
                  feePercentage={settings.fee_percentage}
                  onBuy={handleBuy}
                  onSell={handleSell}
                  processing={processing}
                  isAuthenticated={!!user}
                  coinId={coin.id}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />

      {/* M-PESA Payment Modal */}
      <MpesaPaymentModal
        open={showPaymentModal}
        onOpenChange={(v) => {
          // Only allow closing if NOT in waiting state or on success/failure
          if (v === false && paymentStatus === 'waiting') {
            // Don't close, user needs to wait or timeout
            return;
          }
          setShowPaymentModal(v);
          if (!v) {
            // Modal closed - reset state
            setPaymentStatus('waiting');
            setCurrentTransactionId(null);
          }
        }}
        status={paymentStatus}
        coinSymbol={coin.symbol}
        amount={pendingBuyAmount * effectivePrice}
        onRetry={() => {
          setPaymentStatus('waiting');
          setShowPaymentModal(false);
        }}
      />
    </div>
  );
}
