import "server-only";
import nodemailer from "nodemailer";

export interface StaffCodeCorrectionNotification {
  email: string;
  fullName: string;
  oldStaffId: string;
  newStaffId: string;
}

/**
 * Send email notification to staff about their corrected staff ID
 */
export async function sendStaffCodeCorrectionEmail(
  notification: StaffCodeCorrectionNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    // Configure email transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const emailContent = `
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

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || "noreply@globetechimpact.com",
      to: notification.email,
      subject: `Your Staff ID Has Been Updated - Action Required`,
      html: emailContent,
    });

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

  for (const notification of notifications) {
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
