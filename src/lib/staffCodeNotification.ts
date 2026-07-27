import "server-only";

export interface StaffCodeCorrectionNotification {
  email: string;
  fullName: string;
  oldStaffId: string;
  newStaffId: string;
}

function buildStaffCodeCorrectionEmailHtml(notification: StaffCodeCorrectionNotification): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .content { margin-bottom: 20px; }
    .staff-code-box { background-color: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 15px 0; }
    .staff-code-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .staff-code-value { font-size: 18px; font-weight: bold; color: #0066cc; font-family: monospace; }
    .login-info { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .footer { color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Staff ID Correction Notice</h1>
      <p>Hello ${notification.fullName},</p>
    </div>

    <div class="content">
      <p>We recently identified and corrected an issue with your staff ID. Your account has been updated with a new standardized staff ID.</p>

      <div class="staff-code-box">
        <div class="staff-code-label">Your Old Staff ID (No Longer Valid)</div>
        <div class="staff-code-value">${notification.oldStaffId}</div>
      </div>

      <div class="staff-code-box">
        <div class="staff-code-label">Your New Staff ID (Use This)</div>
        <div class="staff-code-value">${notification.newStaffId}</div>
      </div>

      <h2>How to Login</h2>
      <p>You can now login to the Globe-Tech portal using either:</p>

      <div class="login-info">
        <p><strong>Option 1: Your Email Address</strong></p>
        <p>Email: ${notification.email}</p>
        <p>Password: Your existing password (unchanged)</p>
      </div>

      <div class="login-info">
        <p><strong>Option 2: Your New Staff ID</strong></p>
        <p>Staff ID: ${notification.newStaffId}</p>
        <p>Password: Your existing password (unchanged)</p>
      </div>

      <p><strong>Important:</strong> Your password has NOT changed. You can continue using your existing password to login with either your email or your new staff ID.</p>

      <p>If you have any questions or encounter any issues logging in, please contact our support team.</p>
    </div>

    <div class="footer">
      <p>This is an automated message from Globe-Tech. Please do not reply to this email.</p>
      <p>&copy; 2026 Globe-Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send email notification to staff about their corrected staff ID via Resend
 * (same provider already used for grant-code emails in src/lib/email.ts).
 */
export async function sendStaffCodeCorrectionEmail(
  notification: StaffCodeCorrectionNotification
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not set. Add it in Vercel's environment variables." };
  }
  const from = process.env.GRANT_EMAIL_FROM || "Globe-Tech SME Grant <grant@globetechimpact.com>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: notification.email,
        subject: "Your Staff ID Has Been Updated - Action Required",
        html: buildStaffCodeCorrectionEmailHtml(notification),
      }),
    });

    if (!res.ok) {
      throw new Error(`Resend API error: ${res.status} ${await res.text()}`);
    }

    console.log(`[Email] Sent staff code correction email to ${notification.email}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Failed to send email to ${notification.email}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send emails to all staff with corrected codes
 */
export async function sendBulkStaffCodeNotifications(
  notifications: StaffCodeCorrectionNotification[]
): Promise<{
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}> {
  const result = {
    total: notifications.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  console.log(`[Email] Sending ${notifications.length} staff code correction emails...`);

  // Resend allows 10 requests/second — space sends out to stay under that
  // instead of firing sequential calls as fast as the event loop allows.
  const MIN_INTERVAL_MS = 150;

  for (let i = 0; i < notifications.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS));
    }

    const notification = notifications[i]!;
    const sendResult = await sendStaffCodeCorrectionEmail(notification);
    if (sendResult.success) {
      result.successful++;
    } else {
      result.failed++;
      result.errors.push({
        email: notification.email,
        error: sendResult.error || "Unknown error",
      });
    }
  }

  console.log(
    `[Email] Bulk send complete: ${result.successful} successful, ${result.failed} failed`
  );
  return result;
}
