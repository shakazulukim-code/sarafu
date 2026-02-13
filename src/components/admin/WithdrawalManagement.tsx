import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowUpRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  withdrawal_fee: number;
  mpesa_receipt?: string;
  mpesa_error_reason?: string;
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export function WithdrawalManagement() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('withdrawal_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawal_requests' },
        () => {
          fetchWithdrawals();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to fetch withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setAdminNotes('');
    setShowApprovalDialog(true);
  };

  const handleReject = async (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setAdminNotes('');
    setShowApprovalDialog(true);
  };

  const submitApproval = async (approve: boolean) => {
    if (!selectedWithdrawal) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: approve ? 'approved' : 'rejected',
          admin_notes: adminNotes,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedWithdrawal.id);

      if (error) throw error;

      toast.success(
        `Withdrawal ${approve ? 'approved' : 'rejected'}. ${
          approve ? 'Admin will now process the payout.' : ''
        }`
      );
      setShowApprovalDialog(false);
      setSelectedWithdrawal(null);
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to update withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayout = async (withdrawal: WithdrawalRequest) => {
    if (!confirm('Process M-PESA payout for KES ' + withdrawal.amount + '?')) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-b2c-payout', {
        body: { withdrawalId: withdrawal.id },
      });

      if (error || (data && !data.success)) {
        throw new Error(data?.error || error?.message || 'Payout failed');
      }

      toast.success('Payout initiated! M-PESA response received.');
      fetchWithdrawals();
    } catch (error: any) {
      console.error('Payout error:', error);
      toast.error(error.message || 'Failed to process payout');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-warning';
      case 'approved':
        return 'text-info';
      case 'rejected':
        return 'text-destructive';
      case 'processing':
        return 'text-primary';
      case 'completed':
        return 'text-success';
      case 'failed':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" />
                Withdrawal Requests
              </CardTitle>
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected', 'all'].map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setFilter(f as any);
                      setLoading(true);
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No withdrawal requests found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">User ID</th>
                      <th className="text-left py-3 px-4 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Fee</th>
                      <th className="text-left py-3 px-4 font-semibold">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((withdrawal) => (
                      <motion.tr
                        key={withdrawal.id}
                        className="border-b border-border/30 hover:bg-muted/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <td className="py-3 px-4 text-xs">
                          {new Date(withdrawal.created_at).toLocaleDateString('en-KE')}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono">
                          {withdrawal.user_id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          KES {withdrawal.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          KES {withdrawal.withdrawal_fee.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono">
                          {withdrawal.phone}
                        </td>
                        <td className="py-3 px-4">
                          <div className={`flex items-center gap-2 ${getStatusColor(withdrawal.status)}`}>
                            {getStatusIcon(withdrawal.status)}
                            <span className="capitalize">{withdrawal.status}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {withdrawal.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleApprove(withdrawal)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(withdrawal)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {withdrawal.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={() => handleProcessPayout(withdrawal)}
                                disabled={processing}
                              >
                                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Payout'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedWithdrawal(withdrawal)}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="glass-card border-border/50 max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>
              {selectedWithdrawal?.status === 'pending'
                ? 'Review Withdrawal Request'
                : 'Withdrawal Details'}
            </DialogTitle>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">
                    KES {selectedWithdrawal.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fee</p>
                  <p className="text-lg font-bold">
                    KES {selectedWithdrawal.withdrawal_fee.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="p-2 bg-muted/30 rounded text-sm font-mono">
                  {selectedWithdrawal.phone}
                </div>
              </div>

              {selectedWithdrawal.reason && (
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <div className="p-2 bg-muted/30 rounded text-sm">
                    {selectedWithdrawal.reason}
                  </div>
                </div>
              )}

              {selectedWithdrawal.admin_notes && (
                <div className="space-y-2">
                  <Label>Admin Notes</Label>
                  <div className="p-2 bg-muted/30 rounded text-sm">
                    {selectedWithdrawal.admin_notes}
                  </div>
                </div>
              )}

              {selectedWithdrawal.mpesa_error_reason && (
                <div className="p-3 rounded-lg bg-destructive/10 text-sm">
                  <p className="font-semibold text-destructive">Error:</p>
                  <p>{selectedWithdrawal.mpesa_error_reason}</p>
                </div>
              )}

              {selectedWithdrawal.status === 'pending' && (
                <>
                  <div className="space-y-2">
                    <Label>Admin Notes (optional)</Label>
                    <Textarea
                      placeholder="Add notes about this withdrawal..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="bg-muted/30 min-h-20"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => submitApproval(false)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                    </Button>
                    <Button
                      variant="success"
                      className="flex-1"
                      onClick={() => submitApproval(true)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={selectedWithdrawal !== null && !showApprovalDialog} onOpenChange={(v) => {
        if (!v) setSelectedWithdrawal(null);
      }}>
        <DialogContent className="glass-card border-border/50 max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <div className={`p-3 rounded-lg bg-muted/30 font-semibold ${getStatusColor(selectedWithdrawal.status)}`}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedWithdrawal.status)}
                    {selectedWithdrawal.status.charAt(0).toUpperCase() +
                      selectedWithdrawal.status.slice(1)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">
                    KES {selectedWithdrawal.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Amount</p>
                  <p className="text-lg font-bold text-success">
                    KES{' '}
                    {(
                      selectedWithdrawal.amount -
                      selectedWithdrawal.withdrawal_fee
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="p-2 bg-muted/30 rounded text-sm font-mono">
                  {selectedWithdrawal.phone}
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Created:{' '}
                  {new Date(selectedWithdrawal.created_at).toLocaleString('en-KE')}
                </p>
                {selectedWithdrawal.approved_at && (
                  <p>
                    Approved:{' '}
                    {new Date(selectedWithdrawal.approved_at).toLocaleString('en-KE')}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
