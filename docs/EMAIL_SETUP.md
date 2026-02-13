# Email Delivery Optimization (SPF, DKIM, DMARC)

To ensure your transactional emails (Welcome, Password Reset, Admin Alerts) land in the inbox and not the spam folder, you must configure your DNS records correctly with your domain provider (e.g., GoDaddy, Namecheap, Cloudflare).

## 1. SMTP Configuration (Resend)

If you are using **Resend**, you have two options:
1. **API Integration**: Use the `send-email` Edge Function (already implemented).
2. **Supabase Auth SMTP**: Configure Supabase to use Resend's SMTP server so that default Auth emails also use your domain.

### SMTP Settings for Supabase:
- **Host**: `smtp.resend.com`
- **Port**: `465` or `587`
- **Username**: `resend`
- **Password**: Your Resend API Key

## 2. DNS Verification Records

Add the following records to your domain's DNS settings. Replace `yourdomain.com` with your actual domain.

### SPF (Sender Policy Framework)
Prevents spoofing by specifying which mail servers are permitted to send email on behalf of your domain.
- **Type**: TXT
- **Name**: `@` or blank
- **Value**: `v=spf1 include:amazonses.com ~all` (Resend uses AWS SES infrastructure)

### DKIM (DomainKeys Identified Mail)
Provides a cryptographic signature to verify that the email was indeed sent by your domain.
- **Type**: CNAME (Usually 3 records provided by Resend during domain verification)
- **Names**: `resend1._domainkey`, `resend2._domainkey`, `resend3._domainkey`
- **Value**: (Values provided in Resend Dashboard)

### DMARC (Domain-based Message Authentication)
Tells the receiving server what to do if an email fails SPF or DKIM checks.
- **Type**: TXT
- **Name**: `_dmarc`
- **Value**: `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com`
  - *Note: `p=none` is for monitoring. Later, change to `p=quarantine` or `p=reject` for better security.*

## 3. Implementation Checklist
- [ ] Verify domain in [Resend Dashboard](https://resend.com/domains).
- [ ] Add the DNS records shown in Resend.
- [ ] Set `RESEND_API_KEY` in Supabase Secrets:
  ```bash
  supabase secrets set RESEND_API_KEY=re_your_api_key
  ```
- [ ] (Optional) Update Supabase Auth SMTP settings with Resend details.
