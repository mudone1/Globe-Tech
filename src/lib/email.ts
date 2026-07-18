import "server-only";

const DEFAULT_FROM = "Globe-Tech SME Grant <grant@globetechimpact.com>";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

/**
 * Builds the HTML for the "how to open your FirstBank account" email —
 * mirrors FirstSME_Basic_Account_Guide.docx step for step, with the
 * applicant's Grant Code (their referrer's staffId) called out prominently
 * and re-emphasized at Step 6, where it actually gets entered.
 *
 * Email-safe HTML only: inline styles, no flexbox/grid, explicit image
 * dimensions — this needs to render consistently in Gmail/Outlook/Apple Mail.
 */
export function buildGrantCodeEmailHtml(opts: {
  applicantName: string;
  grantCode: string;
  appUrl: string;
  grantCategoryName: string;
  grantAmount: number;
  applicationId: string;
}): string {
  const { applicantName, grantCode, appUrl, grantCategoryName, grantAmount, applicationId } = opts;
  const name = firstName(applicantName);
  const img = (n: number) => `${appUrl}/email/step-${n}.png`;
  const continuationLink = `${appUrl}/apply/account-details/${applicationId}`;

  const steps: { title: string; body: string; image: number; callout?: string }[] = [
    { title: "Step 1: Start the application", body: "Click the link below, then click the black \u201cCreate Account\u201d button on the welcome page.", image: 1 },
    { title: "Step 2: Get ready", body: "On the next screen, click \u201cI'm Ready\u201d to continue.", image: 2 },
    { title: "Step 3: Enter your phone and email", body: "Type in your phone number and email address. Then type the code shown in the picture (CAPTCHA) into the box, and click \u201cProceed\u201d.", image: 3 },
    { title: "Step 4: Confirm your email", body: "A 6-digit code will be sent to your email. Open your email, copy the code, type it in, and click \u201cProceed\u201d.", image: 4 },
    { title: "Step 5: Business information", body: "Type your business Registration Number and click \u201cValidate\u201d. Then fill in the Date of Registration and Jurisdiction of Incorporation.", image: 5 },
    {
      title: "Step 6: Choose your branch and enter your Grant Code",
      body: "Select your Preferred Branch from the list. Then look for the box labelled \u201cAdditional Information\u201d.",
      image: 6,
      callout: `You MUST type your Grant Code <strong>${grantCode}</strong> exactly as shown into the "Additional Information" box before clicking Continue. If this code is entered incorrectly, we will not be able to link your account to the grant you applied for.`,
    },
    { title: "Step 7: Enter your BVN and NIN", body: "Type in your 11-digit BVN and your 11-digit NIN. (If you don't know your BVN, dial *565*0# on your phone to receive it by SMS.)", image: 7 },
    { title: "Step 8: Take a selfie", body: "Follow the on-screen instructions for \u201cFace Capture\u201d. Stand in a brightly lit area and look straight at the camera.", image: 8 },
    { title: "Step 9: Upload your signature and answer a few questions", body: "Upload a photo of your signature. Answer \u201cAre you a Politically Exposed Person?\u201d (choose No, unless it applies to you). Then tick your Business role \u2014 Director, Share Holder, and/or Signatory.", image: 9 },
    { title: "Step 10: Add a reference and finish", body: "Enter the Name, Email, and Phone Number of someone who already has an account with FirstBank, to serve as your reference. Complete the remaining business documents, then submit to finish.", image: 10 },
  ];

  const stepsHtml = steps
    .map(
      (s) => `
      <tr>
        <td style="padding:28px 32px 0;">
          <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#0B2A18;">${s.title}</p>
          <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#4B5B52;">${s.body}</p>
          ${
            s.callout
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:#FBF3E2;border:1px solid #E9CE8F;border-radius:8px;"><tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0B2A18;">${s.callout}</td></tr></table>`
              : ""
          }
          <img src="${img(s.image)}" width="536" alt="${s.title}" style="display:block;width:100%;max-width:536px;height:auto;border:1px solid #DCE6DE;border-radius:8px;" />
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#F5F8F5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8F5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DCE6DE;">
            <tr>
              <td style="background:#0B2A18;padding:28px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#C8952A;">Globe-Tech SME Grant Program</p>
                <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#FFFFFF;">You're in, ${name}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0B2A18;">
                  Your application for the <strong>${grantCategoryName}</strong> (₦${grantAmount.toLocaleString()})
                  has been received. Recipients are selected by random draw from eligible applicants every
                  quarter — there's nothing more to do on that front. In the meantime, the next step is opening
                  your FirstSME Basic account with FirstBank \u2014 it only takes a few minutes on your phone or
                  computer. Follow the steps below.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#0E7A3A;border-radius:10px;">
                  <tr>
                    <td style="padding:18px 20px;text-align:center;">
                      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#D7E4D9;">Your Grant Code</p>
                      <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:1px;color:#FFFFFF;">${grantCode}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4B5B52;">
                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below \u2014 it's what
                  links your new account to your grant application.
                </p>
              </td>
            </tr>
            ${stepsHtml}
            <tr>
              <td style="padding:28px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D2C1A;border:1px solid #1E4A2E;border-radius:10px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:#FFFFFF;">One more step — later</p>
                      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;color:#D7E4D9;">
                        Once you've finished opening your FirstBank account above, come back to the link below
                        <strong>any time after 48 hours</strong> from now to submit your new account details \u2014
                        that's the final step to complete your application. Bookmark this link or keep this email:
                      </p>
                      <a href="${continuationLink}" style="display:inline-block;background:#C8952A;color:#1A1204;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;padding:11px 18px;border-radius:8px;text-decoration:none;">
                        Submit my account details \u2192
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#0B2A18;">
                  That's it \u2014 you're done! If you get stuck at any step, just reply to this email and we'll help you through it.
                </p>
                <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.6;color:#7FA688;">
                  Globe-Tech SME Grant &amp; Business Support Program
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendGrantCodeEmail(opts: {
  to: string;
  applicantName: string;
  grantCode: string;
  grantCategoryName: string;
  grantAmount: number;
  applicationId: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Add it in Vercel's environment variables.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set — needed to build the image links in the email.");
  }
  const from = process.env.GRANT_EMAIL_FROM || DEFAULT_FROM;

  const html = buildGrantCodeEmailHtml({
    applicantName: opts.applicantName,
    grantCode: opts.grantCode,
    appUrl,
    grantCategoryName: opts.grantCategoryName,
    grantAmount: opts.grantAmount,
    applicationId: opts.applicationId,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: "Your Grant Code — next step: open your FirstBank account",
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error: ${res.status} ${await res.text()}`);
  }
}
