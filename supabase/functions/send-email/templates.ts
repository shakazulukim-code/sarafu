export const getPasswordResetTemplate = (resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { text-align: center; padding-bottom: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { font-size: 12px; color: #999; text-align: center; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Noble Coin Launch</h1>
    </div>
    <p>Hello,</p>
    <p>We received a request to reset your password. Click the button below to set a new one:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <p>Link: <a href="${resetLink}">${resetLink}</a></p>
    <div class="footer">
      &copy; 2026 Noble Coin Launch. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const getWelcomeTemplate = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { text-align: center; padding-bottom: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { font-size: 12px; color: #999; text-align: center; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Noble Coin Launch!</h1>
    </div>
    <p>Hi ${name},</p>
    <p>We're thrilled to have you join our community. Noble Coin Launch is the premier platform for launching and trading tokens with M-PESA.</p>
    <p>Get started by exploring the latest coins on our launchpad:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://noblecoinlaunch.com/launchpad" class="button">Visit Launchpad</a>
    </div>
    <p>If you have any questions, feel free to reply to this email.</p>
    <div class="footer">
      &copy; 2026 Noble Coin Launch. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const getAdminNotificationTemplate = (type: string, details: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { background-color: #f8f9fa; padding: 10px; text-align: center; border-radius: 5px; }
    .details { background-color: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; }
    .footer { font-size: 12px; color: #999; text-align: center; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Admin Alert: ${type}</h2>
    </div>
    <p>New activity detected on the platform:</p>
    <div class="details">
      ${details}
    </div>
    <p>Please log in to the admin panel to take action.</p>
    <div class="footer">
      &copy; 2026 Noble Coin Launch. All rights reserved.
    </div>
  </div>
</body>
</html>
`;
