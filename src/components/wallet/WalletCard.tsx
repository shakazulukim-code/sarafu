import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, ArrowUpRight, ArrowDownLeft, Phone, Loader2, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SpiralLoader } from '@/components/ui/spiral-loader';

interface WalletCardProps {
  fiatBalance: number;
  userId: string;
  onBalanceChange: () => void;
}

type DepositStatus = 'form' | 'processing' | 'success' | 'failed' | 'timeout';
type WithdrawStatus = 'form' | 'success' | 'failed';

export function WalletCard({ fiatBalance, userId, onBalanceChange }: WalletCardProps) {
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [depositStatus, setDepositStatus] = useState<DepositStatus>('form');
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus>('form');
  const [minDeposit, setMinDeposit] = useState(100);
  const [minWithdraw, setMinWithdraw] = useState(100);
  const [maxWithdraw, setMaxWithdraw] = useState(50000);
  const [withdrawFeePercent, setWithdrawFeePercent] = useState(2.5);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('site_settings').select('min_buy_amount, min_withdrawal, max_withdrawal, withdrawal_fee_percentage').maybeSingle();
      if (data?.min_buy_amount) setMinDeposit(data.min_buy_amount);
      if (data?.min_withdrawal) setMinWithdraw(data.min_withdrawal);
      if (data?.max_withdrawal) setMaxWithdraw(data.max_withdrawal);
      if (data?.withdrawal_fee_percentage) setWithdrawFeePercent(data.withdrawal_fee_percentage);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (depositStatus !== 'processing') { setElapsed(0); return; }
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [depositStatus]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);
    if (!depositAmount || !phone) {
      toast.error('Please fill all fields');
      return;
    }
    if (depositAmount < minDeposit) {
      toast.error(`Minimum deposit is KES ${minDeposit}`);
      return;
    }

    setDepositStatus('processing');
    try {
      let formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

      // Create deposit transaction first
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          coin_id: null,
          type: 'deposit',
          amount: depositAmount,
          price_per_coin: 1,
          total_value: depositAmount,
          phone: formattedPhone,
          status: 'pending',
        })
        .select()
        .single();

      if (txError) throw txError;

      console.log('📝 Deposit transaction created:', transaction.id);

      // Send STK push
      const { data: stkData, error: stkError } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: formattedPhone,
          amount: Math.round(depositAmount),
          transactionId: transaction.id,
          type: 'deposit',
          accountReference: `DEPOSIT`,
        },
      });

      if (stkError || (stkData && !stkData.success)) {
        console.error('Deposit STK error:', stkError?.message || stkData?.error);
        await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id);
        setDepositStatus('failed');
        toast.error('Failed to send STK push');
        return;
      }

      console.log('✅ STK Push sent! Check your phone.');
      toast.success('Check your phone for M-PESA prompt!');

      // Update transaction with CheckoutRequestID
      if (stkData?.checkoutRequestId) {
        console.log('📌 Storing CheckoutRequestID:', stkData.checkoutRequestId);
        await supabase
          .from('transactions')
          .update({
            mpesa_receipt: stkData.checkoutRequestId,
            status: 'stk_sent',
          })
          .eq('id', transaction.id);
      }

      // Subscribe to real-time transaction updates
      let channelSubscribed = false;
      let timeoutTimer: NodeJS.Timeout | null = null;
      
      const channel = supabase
        .channel(`transaction-deposit-${transaction.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${transaction.id}` },
          (payload: any) => {
            const txStatus = payload.new.status;
            const errorMsg = payload.new.error_reason;
            console.log('🔄 Real-time deposit update received:', { status: txStatus, error: errorMsg });
            
            if (txStatus === 'completed') {
              console.log('✅ Deposit payment completed via real-time!');
              setDepositStatus('success');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              onBalanceChange();
              toast.success(`Deposit successful! Added KES ${depositAmount.toLocaleString()} to your wallet.`);
            } else if (txStatus === 'cancelled' || txStatus === 'failed') {
              console.log('❌ Deposit payment cancelled/failed via real-time:', errorMsg);
              setDepositStatus('failed');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
              if (errorMsg) toast.error(errorMsg);
            }
          }
        )
        .subscribe(() => {
          channelSubscribed = true;
          console.log('📡 Subscribed to deposit transaction real-time updates');
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
              .select('mpesa_receipt')
              .eq('id', transaction.id)
              .single();
            checkoutRequestId = tx?.mpesa_receipt;
          }

          if (!checkoutRequestId) {
            console.log(`⏱️ Deposit poll ${attempts}: Waiting for CheckoutRequestID...`);
            if (attempts < maxAttempts) {
              setTimeout(pollStatus, 2000);
            } else {
              setDepositStatus('timeout');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
            }
            return;
          }

          // Query M-PESA status via Supabase function
          console.log(`⏱️ Deposit poll ${attempts}: Querying M-PESA for ${checkoutRequestId.substring(0, 8)}...`);
          
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
              setDepositStatus('timeout');
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (channelSubscribed) supabase.removeChannel(channel);
            }
            return;
          }

          if (attempts >= maxAttempts) {
            console.log('⏰ Poll timeout');
            setDepositStatus('timeout');
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (channelSubscribed) supabase.removeChannel(channel);
            toast.error('Deposit verification timed out. Please check your M-PESA.');
          } else {
            setTimeout(pollStatus, 2000);
          }
        } catch (err) {
          console.error('Polling error:', err);
          if (attempts >= maxAttempts) {
            setDepositStatus('timeout');
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (channelSubscribed) supabase.removeChannel(channel);
          } else {
            setTimeout(pollStatus, 2000);
          }
        }
      };

      // Auto-timeout after 90 seconds
      timeoutTimer = setTimeout(() => {
        if (depositStatus === 'processing') {
          console.warn('⏰ Deposit timeout after 90 seconds');
          setDepositStatus('timeout');
          if (channelSubscribed) supabase.removeChannel(channel);
        }
      }, 90000);

      // Start polling
      console.log('🚀 Starting M-PESA polling for deposit...');
      pollStatus();
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error(error.message || 'Failed to process deposit');
      setDepositStatus('failed');
    }
  };

  const handleWithdraw = async () => {
    if (!amount || !phone) {
      toast.error('Please fill all fields');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    
    // Validation
    if (withdrawAmount < minWithdraw) {
      toast.error(`Minimum withdrawal is KES ${minWithdraw}`);
      return;
    }
    if (withdrawAmount > maxWithdraw) {
      toast.error(`Maximum withdrawal is KES ${maxWithdraw}`);
      return;
    }
    if (withdrawAmount > fiatBalance) {
      toast.error('Insufficient balance');
      return;
    }

    setProcessing(true);
    try {
      let formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;

      // Calculate withdrawal fee
      const withdrawalFee = (withdrawAmount * withdrawFeePercent) / 100;
      const netAmount = withdrawAmount - withdrawalFee;

      console.log(`📤 Withdrawal request: ${withdrawAmount} KES, fee: ${withdrawalFee} KES, net: ${netAmount} KES`);

      // Create withdrawal request
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: userId,
          amount: withdrawAmount,
          phone: formattedPhone,
          reason: reason || null,
          withdrawal_fee: withdrawalFee,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Deduct from wallet immediately (goes to pending state)
      await supabase
        .from('wallets')
        .update({ fiat_balance: fiatBalance - withdrawAmount })
        .eq('user_id', userId);

      console.log('✅ Withdrawal request created:', data.id);
      setWithdrawStatus('success');
      toast.success(`Withdrawal request submitted! Admin will review within 24 hours.`);
      
      // Close dialog after 2 seconds
      setTimeout(() => {
        setShowWithdraw(false);
        setWithdrawStatus('form');
        setAmount('');
        setPhone('');
        setReason('');
        onBalanceChange();
      }, 2000);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Failed to process withdrawal');
      setWithdrawStatus('failed');
    } finally {
      setProcessing(false);
    }
  };

  const closeDeposit = () => {
    setShowDeposit(false);
    setDepositStatus('form');
    setAmount('');
    setPhone('');
    setElapsed(0);
  };

  return (
    <>
      <Card className="glass-card overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Fiat Wallet
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onBalanceChange}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-bold gradient-text mb-4">
            KES {fiatBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="flex gap-2">
            <Button variant="success" size="sm" className="flex-1 gap-2" onClick={() => setShowDeposit(true)}>
              <ArrowDownLeft className="h-4 w-4" /> Deposit
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setShowWithdraw(true)}>
              <ArrowUpRight className="h-4 w-4" /> Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={showDeposit} onOpenChange={(v) => { if (depositStatus !== 'processing') { if (!v) closeDeposit(); else setShowDeposit(v); } }}>
        <DialogContent className="glass-card border-border/50 max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-success" />
              Deposit via M-PESA
            </DialogTitle>
            <DialogDescription>
              {depositStatus === 'form' && 'Fund your wallet using M-PESA mobile money'}
              {depositStatus === 'processing' && 'Waiting for M-PESA confirmation...'}
              {depositStatus === 'success' && 'Deposit successful!'}
              {depositStatus === 'failed' && 'Deposit failed or cancelled'}
              {depositStatus === 'timeout' && 'Request timed out'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {depositStatus === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount (KES)</Label>
                  <Input type="number" placeholder={`Min ${minDeposit}`} value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-muted/30 h-12 text-lg font-mono" />
                  <p className="text-xs text-muted-foreground">Minimum deposit: KES {minDeposit.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> M-PESA Phone Number</Label>
                  <Input type="tel" placeholder="254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-muted/30 h-12 font-mono" />
                </div>
                <Button variant="success" className="w-full gap-2 h-12" onClick={handleDeposit} disabled={!amount || !phone || parseFloat(amount) < minDeposit}>
                  Deposit KES {amount || '0'}
                </Button>
              </motion.div>
            )}

            {depositStatus === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 flex flex-col items-center gap-4">
                <SpiralLoader size="lg" />
                <p className="text-sm text-muted-foreground">Check your phone for STK push</p>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-primary">{formatTime(elapsed)}</span>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    <span className="text-success">STK Push sent</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </motion.div>
                    <span className="text-warning">Awaiting PIN entry...</span>
                  </div>
                </div>
              </motion.div>
            )}

            {depositStatus === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}
                  className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </motion.div>
                <p className="text-lg font-bold text-success">Deposit Successful!</p>
                <p className="text-sm text-muted-foreground">Funds have been added to your wallet</p>
                <Button variant="hero" onClick={closeDeposit}>Done</Button>
              </motion.div>
            )}

            {depositStatus === 'failed' && (
              <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-lg font-bold text-destructive">Deposit Failed</p>
                <p className="text-sm text-muted-foreground">The transaction was cancelled or failed</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeDeposit}>Close</Button>
                  <Button variant="hero" onClick={() => setDepositStatus('form')}>Try Again</Button>
                </div>
              </motion.div>
            )}

            {depositStatus === 'timeout' && (
              <motion.div key="timeout" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-warning/20 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                </div>
                <p className="text-lg font-bold text-warning">Request Timed Out</p>
                <p className="text-sm text-muted-foreground">Payment wasn't completed in time</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeDeposit}>Close</Button>
                  <Button variant="hero" onClick={() => setDepositStatus('form')}>Try Again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="glass-card border-border/50 max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Withdraw to M-PESA
            </DialogTitle>
            <DialogDescription>
              {withdrawStatus === 'form' && 'Submit a withdrawal request for admin approval'}
              {withdrawStatus === 'success' && 'Withdrawal request submitted!'}
              {withdrawStatus === 'failed' && 'Withdrawal request failed'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {withdrawStatus === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  Available Balance: <span className="font-bold">KES {fiatBalance.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  <Label>Amount (KES)</Label>
                  <Input 
                    type="number" 
                    placeholder={`Min ${minWithdraw} - Max ${maxWithdraw}`} 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="bg-muted/30 h-12 text-lg font-mono" 
                    min={minWithdraw}
                    max={maxWithdraw}
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: KES {minWithdraw.toLocaleString()} - KES {maxWithdraw.toLocaleString()}
                  </p>
                </div>

                {amount && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-primary/10 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Withdrawal Fee ({withdrawFeePercent}%):</span>
                      <span className="font-mono">- KES {((parseFloat(amount) * withdrawFeePercent) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-primary/20 pt-2">
                      <span>You'll Receive:</span>
                      <span className="text-success">KES {(parseFloat(amount) - (parseFloat(amount) * withdrawFeePercent) / 100).toFixed(2)}</span>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> M-PESA Phone Number</Label>
                  <Input 
                    type="tel" 
                    placeholder="254712345678" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="bg-muted/30 h-12 font-mono" 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Input 
                    type="text" 
                    placeholder="Personal use, savings, etc." 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    className="bg-muted/30" 
                  />
                </div>

                <Button 
                  variant="hero" 
                  className="w-full gap-2 h-12" 
                  onClick={handleWithdraw} 
                  disabled={processing || !amount || !phone || parseFloat(amount) < minWithdraw || parseFloat(amount) > maxWithdraw}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Request Withdrawal</>}
                </Button>
              </motion.div>
            )}

            {withdrawStatus === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}
                  className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </motion.div>
                <p className="text-lg font-bold text-success">Request Submitted!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Your withdrawal request has been submitted for admin review. This typically takes 24 hours.
                </p>
                <Button variant="hero" onClick={() => {
                  setShowWithdraw(false);
                  setWithdrawStatus('form');
                }}>Done</Button>
              </motion.div>
            )}

            {withdrawStatus === 'failed' && (
              <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-lg font-bold text-destructive">Request Failed</p>
                <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowWithdraw(false)}>Close</Button>
                  <Button variant="hero" onClick={() => setWithdrawStatus('form')}>Try Again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
