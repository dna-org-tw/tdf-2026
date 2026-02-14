import formData from 'form-data';
import Mailgun from 'mailgun.js';
import crypto from 'crypto';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET || 'default-secret-change-in-production';

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({
      username: 'api',
      key: mailgunApiKey,
    })
  : null;

/**
 * 產生取消訂閱的 token
 */
export function generateUnsubscribeToken(email: string): string {
  const hash = crypto
    .createHmac('sha256', unsubscribeSecret)
    .update(email)
    .digest('hex');
  
  // 將 email 與 hash 組合為 token（使用 base64 編碼）
  const token = Buffer.from(`${email}:${hash}`).toString('base64url');
  return token;
}

/**
 * 驗證並解析取消訂閱的 token
 */
export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [email, hash] = decoded.split(':');
    
    if (!email || !hash) {
      return null;
    }
    
    // 驗證 hash
    const expectedHash = crypto
      .createHmac('sha256', unsubscribeSecret)
      .update(email)
      .digest('hex');
    
    if (hash !== expectedHash) {
      return null;
    }
    
    return email;
  } catch (error) {
    return null;
  }
}

/**
 * 發送訂閱感謝郵件
 */
export async function sendSubscriptionThankYouEmail(email: string): Promise<boolean> {
  if (!mailgunClient || !mailgunDomain) {
    console.warn('[Email] Mailgun is not configured. Subscription email will not be sent.');
    return false;
  }

  try {
    const unsubscribeToken = generateUnsubscribeToken(email);
    const unsubscribeUrl = `${baseUrl}/newsletter/unsubscribe?token=${unsubscribeToken}`;

    const subject = 'Thank You for Joining Taiwan Digital Nomad Community!';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Thank You for Joining Taiwan Digital Nomad Community!</h2>
    
    <p>Dear ${email},</p>
    
    <p>
      Thank you for subscribing to the Taiwan Digital Nomad Community newsletter! We're thrilled to have you join our community.
    </p>
    
    <p>
      We'll regularly send you the latest event updates, digital nomad resources, and news about Taiwan Digital Fest 2026. Stay tuned for exciting content!
    </p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B8D9;">
      <h3 style="margin-top: 0; color: #1E1F1C;">What You'll Receive:</h3>
      <ul style="color: #666; padding-left: 20px;">
        <li>Latest Taiwan Digital Fest 2026 event information</li>
        <li>Practical digital nomad resources and insights</li>
        <li>Community events and meetup notifications</li>
        <li>Special offers and early bird information</li>
      </ul>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you no longer wish to receive our newsletter, you can
      <a href="${unsubscribeUrl}" style="color: #10B8D9; text-decoration: underline;">
        unsubscribe
      </a> at any time.
    </p>
    
    <p style="color: #666; font-size: 14px;">
      Thank you again for your support!<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>
  
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email. Please do not reply directly to this message.</p>
    <p>
      <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">
        Unsubscribe
      </a>
    </p>
  </div>
</body>
</html>
    `;

    const textContent = `
Taiwan Digital Fest 2026

Thank You for Joining Taiwan Digital Nomad Community!

Dear ${email},

Thank you for subscribing to the Taiwan Digital Nomad Community newsletter! We're thrilled to have you join our community.

We'll regularly send you the latest event updates, digital nomad resources, and news about Taiwan Digital Fest 2026. Stay tuned for exciting content!

What You'll Receive:
- Latest Taiwan Digital Fest 2026 event information
- Practical digital nomad resources and insights
- Community events and meetup notifications
- Special offers and early bird information

If you no longer wish to receive our newsletter, you can unsubscribe at any time:
${unsubscribeUrl}

Thank you again for your support!
Taiwan Digital Fest 2026 Team

---
This is an automated email. Please do not reply directly to this message.
Unsubscribe: ${unsubscribeUrl}
    `;

    const messageData = {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    };

    const response = await mailgunClient.messages.create(mailgunDomain, messageData);

    if (!response || !response.id) {
      console.error('[Email] Failed to send subscription thank you email', response);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] Error sending subscription thank you email', error);
    return false;
  }
}

/**
 * 發送投票確認郵件
 */
export async function sendVoteConfirmationEmail(
  email: string,
  postId: string,
  confirmToken: string
): Promise<boolean> {
  if (!mailgunClient || !mailgunDomain) {
    console.warn('[Email] Mailgun is not configured. Vote confirmation email will not be sent.');
    return false;
  }

  try {
    const confirmUrl = `${baseUrl}/api/award/confirm-vote?token=${encodeURIComponent(confirmToken)}`;

    const subject = 'Confirm Your Nomad Award Vote - Taiwan Digital Fest 2026';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Confirm Your Vote for Nomad Award</h2>
    
    <p>Dear ${email},</p>
    
    <p>
      Thank you for voting in the Nomad Award short video contest! To complete your vote, please click the confirmation button below.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Confirm Your Vote
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    <p style="color: #10B8D9; font-size: 12px; word-break: break-all;">
      ${confirmUrl}
    </p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B8D9;">
      <h3 style="margin-top: 0; color: #1E1F1C;">Important Notes:</h3>
      <ul style="color: #666; padding-left: 20px;">
        <li>Each email can vote once per day</li>
        <li>Voting ends on April 30, 2026 at 12:00 (Taiwan Time)</li>
        <li>Awards ceremony will be held on May 1st evening during the opening event</li>
      </ul>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Thank you for participating in the Nomad Award contest!<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>
  
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email. Please do not reply directly to this message.</p>
  </div>
</body>
</html>
    `;

    const textContent = `
Taiwan Digital Fest 2026

Confirm Your Vote for Nomad Award

Dear ${email},

Thank you for voting in the Nomad Award short video contest! To complete your vote, please click the confirmation link below:

${confirmUrl}

Important Notes:
- Each email can vote once per day
- Voting ends on April 30, 2026 at 12:00 (Taiwan Time)
- Awards ceremony will be held on May 1st evening during the opening event

Thank you for participating in the Nomad Award contest!
Taiwan Digital Fest 2026 Team

---
This is an automated email. Please do not reply directly to this message.
    `;

    const messageData = {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    };

    const response = await mailgunClient.messages.create(mailgunDomain, messageData);

    if (!response || !response.id) {
      console.error('[Email] Failed to send vote confirmation email', response);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] Error sending vote confirmation email', error);
    return false;
  }
}
