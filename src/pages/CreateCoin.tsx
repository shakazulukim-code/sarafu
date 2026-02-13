import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { CoinFormDialog } from '@/components/admin/CoinFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Coins, Loader2, Phone, CreditCard, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { SpiralLoader } from '@/components/ui/spiral-loader';

interface UserCoin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  approval_status: string | null;
  creation_fee_paid: boolean;
  is_approved: boolean;
  logo_url: string | null;
  contract_address: string | null;
}

export default function CreateCoin() {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [myCoins, setMyCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingCoinId, setPayingCoinId] = useState<string | null>(null);
  const [payPhone, setPayPhone] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [gasFee, setGasFee] = useState(5000);
  const [paymentStatus, setPaymentStatus] = useState<'form' | 'processing' | 'success' | 'failed' | 'timeout'>('form');

  useEffect(() => {
    if (user) fetchMyCoins();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('site_settings').select('coin_creation_fee').maybeSingle();
      if (data?.coin_creation_fee) setGasFee(data.coin_creation_fee);
    };
    fetchSettings();
  }, []);

  const fetchMyCoins = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('coins')
        .select('id, name, symbol, price, approval_status, creation_fee_paid, is_approved, logo_url, contract_address')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      setMyCoins(data || []);
    } catch (err) {
      console.error('Error fetching coins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = async () => {
    if (user) {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'coin_creator')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: user.id, role: 'coin_creator' });
      }
    }
    fetchMyCoins();
  };

  const handlePayGasFee = async () => {
    if (!payingCoinId || !payPhone || payPhone.length < 9) {
      toast.error('Enter a valid phone number');
      return;
    }

    setPaymentStatus('processing');
    setPayProcessing(true);

    try {
      let formattedPhone = payPhone.replace(/\s+/g, '').replace(/^\+/, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

      // Create coin creation transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          coin_id: payingCoinId,
          type: 'coin_creation',
          amount: 1,
          price_per_coin: gasFee,
          total_value: gasFee,
          phone: formattedPhone,
          status: 'pending',
        })
        .select()
        .single();

      if (txError) throw txError;

      console.log('📝 Coin creation transaction created:', transaction.id);

      // Send STK push
      const { data: stkData, error: stkError } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: formattedPhone,
          amount: Math.round(gasFee),
          transactionId: transaction.id,
          accountReference: `GAS-PAY`,
          type: 'coin_creation',
        },
      });

      if (stkError || (stkData && !stkData.success)) {
        toast.error('Failed to send STK push. Try again.');
        await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id);
        setPaymentStatus('failed');
        setPayProcessing(false);
        return;
      }

      console.log('✅ STK Push sent! Check your phone.');
      toast.success('Check your phone for M-PESA prompt!');

      // Update transaction with CheckoutRequestID
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
        }
      }

      // Subscribe to real-time transaction updates
      let channelSubscribed = false;
      let timeoutTimer: NodeJS.Timeout | null = null;

      const channel = supabase
        .channel(`transaction-gas-fee-${transaction.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${transaction.id}` },
          (payload: any) => {
            const txStatus = payload.new.status;
            const errorMsg = payload.new.error_reason;
            console.log('🔄 Real-time gas fee transaction update received:', { status: txStatus, error: errorMsg });
            
            if (txStatus === 'completed') {
              console.log('✅ Gas fee payment completed via real-time!');
              setPaymentStatus('success');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              toast.success('Gas fee paid! Coin is now pending approval.');
              fetchMyCoins();
            } else if (txStatus === 'cancelled' || txStatus === 'failed') {
              console.log('❌ Gas fee payment cancelled/failed via real-time:', errorMsg);
              setPaymentStatus('failed');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              if (errorMsg) toast.error(errorMsg);
            }
          }
        )
        .subscribe(() => {
          channelSubscribed = true;
          console.log('📡 Subscribed to gas fee transaction real-time updates');
        });

      // Poll M-PESA status
      let attempts = 0;
      const maxAttempts = 45;
      let checkoutRequestId: string | null = stkData?.checkoutRequestId;

      const pollStatus = async () => {
        attempts++;
        try {
          // Get CheckoutRequestID if needed
          if (!checkoutRequestId) {
            const { data: tx } = await supabase
              .from('transactions')
              .select('checkout_request_id')
              .eq('id', transaction.id)
              .single();
            checkoutRequestId = tx?.checkout_request_id;
          }

          if (!checkoutRequestId) {
            console.log(`⏱️ Coin creation poll ${attempts}: Waiting for CheckoutRequestID...`);
            if (attempts < maxAttempts) {
              setTimeout(pollStatus, 2000);
            } else {
              setPaymentStatus('timeout');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              toast.error('Payment verification timed out. Please try again.');
            }
            return;
          }

          // Query M-PESA status via Supabase function
          console.log(`⏱️ Coin creation poll ${attempts}: Querying M-PESA for ${checkoutRequestId.substring(0, 8)}...`);
          
          const { data: queryResult, error: funcError } = await supabase.functions.invoke(
            'query-mpesa-status',
            {
              body: {
                transactionId: transaction.id,
                checkoutRequestId,
              },
            }
          );

          if (funcError) {
            console.error('Query error:', funcError);
            if (attempts < maxAttempts) {
              setTimeout(pollStatus, 2000);
            } else {
              setPaymentStatus('timeout');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              toast.error('Payment verification failed. Please try again.');
            }
            return;
          }

          if (attempts >= maxAttempts) {
            console.log('⏰ Poll timeout');
            setPaymentStatus('timeout');
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (channelSubscribed) supabase.removeChannel(channel);
            toast.error('Payment verification timed out. Please try again.');
          } else {
            setTimeout(pollStatus, 2000);
          }
        } catch (err) {
          console.error('Polling error:', err);
          if (attempts >= maxAttempts) {
            setPaymentStatus('timeout');
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (channelSubscribed) supabase.removeChannel(channel);
          } else {
            setTimeout(pollStatus, 2000);
          }
        }
      };

      // Auto-timeout after 90 seconds
      timeoutTimer = setTimeout(() => {
        if (paymentStatus === 'processing') {
          console.warn('⏰ Coin creation timeout after 90 seconds');
          setPaymentStatus('timeout');
          if (channelSubscribed) supabase.removeChannel(channel);
        }
      }, 90000);

      // Start polling
      console.log('🚀 Starting M-PESA polling for coin creation...');
      pollStatus();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
      setPaymentStatus('failed');
      setPayProcessing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mb-1">Create Coin</h1>
              <p className="text-muted-foreground text-sm">Launch your own token on the platform</p>
            </div>
            <Button variant="hero" className="gap-2" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Coin</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </motion.div>

        <div>
          <h2 className="text-lg font-semibold mb-4">My Coins</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myCoins.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No coins yet</h3>
                <p className="text-muted-foreground mb-4 text-sm">Create your first coin and start your crypto journey</p>
                <Button variant="hero" onClick={() => setShowDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Coin
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCoins.map((coin) => (
                <Card key={coin.id} className="glass-card hover:border-primary/50 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center overflow-hidden">
                        {coin.logo_url ? (
                          <img src={coin.logo_url} alt={coin.name} className="h-full w-full object-cover" />
                        ) : (
                          <Coins className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{coin.name}</h4>
                        <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        !coin.creation_fee_paid
                          ? 'bg-destructive/10 text-destructive'
                          : coin.approval_status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : coin.is_approved
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {!coin.creation_fee_paid ? 'Unpaid' : coin.approval_status === 'pending' ? 'Pending' : coin.is_approved ? 'Active' : 'Rejected'}
                      </div>
                    </div>
                    {coin.contract_address && (
                      <p className="text-xs font-mono text-muted-foreground truncate mb-2">{coin.contract_address}</p>
                    )}
                    {/* Pay button for unpaid coins */}
                    {!coin.creation_fee_paid && (
                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full gap-2 mt-1"
                        onClick={() => {
                          setPayingCoinId(coin.id);
                          setShowPayDialog(true);
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay Gas Fee (KES {gasFee.toLocaleString()})
                      </Button>
                    )}
                    {coin.is_approved && (
                      <Link to={`/coin/${coin.id}`}>
                        <Button variant="outline" size="sm" className="w-full mt-1">View Coin</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <CoinFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={handleCreateSuccess}
        userId={user.id}
        isSuperAdmin={false}
      />

      {/* Pay Gas Fee Dialog */}
      <Dialog open={showPayDialog} onOpenChange={(v) => { 
        if (v === false && paymentStatus === 'processing') {
          return; // Prevent accidental close while payment is processing
        }
        if (v === false) {
          setPaymentStatus('form');
          setPayPhone('');
        }
        setShowPayDialog(v);
      }}>
        <DialogContent className="max-w-sm mx-4 glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-warning" />
              Pay Gas Fee
            </DialogTitle>
            <DialogDescription>
              {paymentStatus === 'form' && `Pay KES ${gasFee.toLocaleString()} via M-PESA to list your coin`}
              {paymentStatus === 'processing' && 'Waiting for M-PESA confirmation...'}
              {paymentStatus === 'success' && 'Payment successful!'}
              {paymentStatus === 'failed' && 'Payment failed or cancelled'}
              {paymentStatus === 'timeout' && 'Request timed out'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {paymentStatus === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-center">
                  <p className="text-xl font-bold text-warning">KES {gasFee.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" /> M-PESA Phone
                  </Label>
                  <Input
                    type="tel"
                    placeholder="254712345678"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    className="h-12 text-lg font-mono"
                  />
                </div>
                <Button variant="hero" className="w-full" onClick={handlePayGasFee} disabled={!payPhone || payPhone.length < 9}>
                  Pay Now
                </Button>
              </motion.div>
            )}

            {paymentStatus === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 flex flex-col items-center gap-4">
                <SpiralLoader size="lg" />
                <p className="text-sm text-muted-foreground">Check your phone for STK push</p>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-primary">Processing...</span>
                </div>
              </motion.div>
            )}

            {paymentStatus === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}
                  className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </motion.div>
                <p className="text-lg font-bold text-success">Payment Successful!</p>
                <p className="text-sm text-muted-foreground text-center">Your coin is now pending approval</p>
                <Button variant="hero" onClick={() => {
                  setShowPayDialog(false);
                  setPaymentStatus('form');
                  setPayPhone('');
                }}>Done</Button>
              </motion.div>
            )}

            {paymentStatus === 'failed' && (
              <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-lg font-bold text-destructive">Payment Failed</p>
                <p className="text-sm text-muted-foreground">The transaction was cancelled or failed</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowPayDialog(false);
                    setPaymentStatus('form');
                    setPayPhone('');
                  }}>Close</Button>
                  <Button variant="hero" onClick={() => setPaymentStatus('form')}>Try Again</Button>
                </div>
              </motion.div>
            )}

            {paymentStatus === 'timeout' && (
              <motion.div key="timeout" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-warning/20 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                </div>
                <p className="text-lg font-bold text-warning">Request Timed Out</p>
                <p className="text-sm text-muted-foreground">Payment verification took longer than expected</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowPayDialog(false);
                    setPaymentStatus('form');
                    setPayPhone('');
                  }}>Close</Button>
                  <Button variant="hero" onClick={() => setPaymentStatus('form')}>Try Again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
