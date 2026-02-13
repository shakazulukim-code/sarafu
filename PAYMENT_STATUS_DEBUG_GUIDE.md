# M-PESA Payment Status Debugging Guide

## ✅ What's Been Fixed

1. **Database Schema** - Added missing columns to `transactions` table:
   - `error_reason` - stores error/cancellation messages
   - `merchant_request_id` - tracks M-PESA request IDs
   - Added proper indexes for faster lookups
   - Updated status constraints: `pending`, `processing`, `completed`, `failed`, `cancelled`, `stk_sent`, `timeout`

2. **Backend Functions Deployed** ✅
   - `mpesa-callback` - Processes M-PESA responses with enhanced logging
   - `mpesa-stk-push` - Sends payment requests to M-PESA
   - `check-transaction-status` - Diagnostic endpoint to check transaction status

3. **Frontend Improvements** ✅
   - Frontend now updates transaction with CheckoutRequestID immediately after STK push
   - Direct polling to verify database updates
   - Enhanced logging with emojis for tracking payment flow

## 🔍 How to Debug "Still No Status"

### Step 1: Check Supabase Function Logs
Go to: Supabase Dashboard → Functions → Logs

Check for:
1. **mpesa-stk-push logs** - Should show:
   - "Authenticated user: [user-id]"
   - "STK Push response:" with CheckoutRequestID
   - "Transaction status updated to stk_sent"

2. **mpesa-callback logs** - Should show:
   - "M-PESA Callback received:"
   - "Looking for transaction with mpesa_receipt = '[CheckoutRequestID]'"
   - Either "✅ Transaction found:" or "❌ Transaction not found"
   - "Updating transaction:" with status change
   - "✅ Transaction updated successfully"

### Step 2: Check Transaction in Database
1. Go to Supabase SQL Editor
2. Run:
```sql
SELECT id, status, mpesa_receipt, merchant_request_id, error_reason, created_at, updated_at 
FROM transactions 
ORDER BY created_at DESC 
LIMIT 1;
```

Look for:
- `mpesa_receipt` should contain a CheckoutRequestID (not null)
- `status` should show: `stk_sent` (after STK push) → `completed`, `failed`, or `cancelled` (after callback)
- `merchant_request_id` should match M-PESA MerchantRequestID
- `updated_at` should update when callback comes in

### Step 3: Monitor Browser Console
Open browser DevTools (F12) → Console

Look for logs like:
```
📌 Storing CheckoutRequestID: [ID]
✅ Transaction updated with CheckoutRequestID
📡 Subscribed to transaction updates
⏱️ Direct poll 1/40: status=stk_sent, error=null, receipt=123456ab...
🔄 Transaction update via real-time: completed
✅ Payment completed!
```

### Step 4: Test Transaction Status Check
1. Note the transaction ID from the payment attempt
2. Go to Supabase → SQL Editor
3. Call the status check endpoint:
```bash
curl -X POST https://[your-project].supabase.co/functions/v1/check-transaction-status \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "[transaction-id-here]"}'
```

## 🚨 Common Issues & Fixes

### Issue: "Transaction not found" in callback logs
**Possible Causes:**
- CheckoutRequestID not being stored in `mpesa_receipt` field
- M-PESA callback using different CheckoutRequestID than what we stored
- Timing issue - callback arriving before transaction creation

**Fix:**
- Check if STK push update is completing: Look for "Transaction updated to stk_sent" in logs
- Verify CheckoutRequestID format matches between STK response and M-PESA callback

### Issue: Transaction found but not updating
**Possible Causes:**
- RLS policy blocking updates
- Service role key not working
- Transaction update query failing

**Fix:**
- Check "Failed to update transaction" error in callback logs
- Verify transaction table RLS allows admin updates
- Check transaction ID format is valid UUID

### Issue: Real-time subscription not firing
**Possible Causes:**
- Real-time not enabled on transactions table
- Subscription not properly initiated
- Multiple database updates causing race conditions

**Fix:**
- Check Supabase Settings → Replication → `transactions` table should be included
- Browser console should show "📡 Subscribed to transaction updates"
- Frontend falls back to polling if real-time fails

### Issue: Frontend never changes status
**Possible Causes:**
- Polling stopped prematurely
- Modal handling preventing status updates
- Real-time and polling both failing

**Fix:**
- Check browser console for poll attempts: "⏱️ Direct poll X/40"
- Verify modal isn't preventing update: "Cannot close modal - payment still waiting"
- Check if timeout reached: "⏰ Maximum poll attempts reached"

## 📋 Payment Flow Checklist

```
1. ✅ User initiates payment
   → Transaction created with status='pending'
   → Window shows: "Waiting for M-PESA confirmation..."

2. ✅ STK Push sent
   → Function logs show CheckoutRequestID
   → mpesa_receipt column updated in database
   → Status changes to 'stk_sent'
   → Browser log: "📌 Storing CheckoutRequestID"

3. ✅ User enters M-PESA PIN
   → M-PESA processes payment
   → Callback endpoint receives result

4. ✅ Callback processes result
   → Logs show "Looking for transaction with mpesa_receipt"
   → Logs show "✅ Transaction found"
   → Transaction status updated to: completed/failed/cancelled
   → Log shows timestamp of update

5. ✅ Frontend detects update
   → Real-time subscription fires OR polling detects change
   → Browser logs: "🔄 Transaction update" or "⏱️ Direct poll: status=completed"
   → Modal shows success/failure message
   → Modal auto-closes after 2 seconds

6. ✅ User sees result
   → Success: "✅ Payment Successful! Your coins are ready."
   → Failed: "❌ [Error Message]"
   → Cancelled: "User cancelled the payment"
```

## 🔧 Manual Testing

### Test CheckoutRequestID Storage
```sql
-- Check if transaction has CheckoutRequestID stored
SELECT id, mpesa_receipt, status FROM transactions 
WHERE mpesa_receipt IS NOT NULL 
ORDER BY created_at DESC LIMIT 5;

-- Should return non-null mpesa_receipt values starting with digits
```

### Manually Trigger Status Update (for testing)
```sql
-- Simulate successful M-PESA callback (TESTING ONLY)
UPDATE transactions 
SET status = 'completed', updated_at = now()
WHERE id = '[transaction-id]' AND status = 'stk_sent';
```

Then check browser console for:
- Real-time update: "🔄 Transaction update via real-time: completed"
- Polling update: "⏱️ Direct poll: status=completed"

## 📞 Next Steps if Issue Persists

1. **Share Supabase Function Logs** - Screenshot of mpesa-callback logs from the time of payment
2. **Check Transaction Record** - Run the SQL query above and share the result
3. **Browser Console Logs** - Open DevTools F12 → Console and capture the full payment attempt log
4. **M-PESA Test Response** - If M-PESA isn't calling callback, may need to:
   - Verify callback URL in M-PESA config
   - Test callback endpoint directly with curl
   - Check firewall/network allowing M-PESA to reach callback

## ✅ Deployments Complete
- Database migration: ✅ Applied
- mpesa-callback: ✅ Deployed with enhanced logging
- mpesa-stk-push: ✅ Deployed
- check-transaction-status: ✅ Deployed
- Frontend changes: ⏳ Need to run `npm run build && npx vercel --prod`
