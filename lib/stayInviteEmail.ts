import { sendStayEmail } from './stayEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://2026.taiwandigitalfest.com';

export async function sendStayInviteEmail(input: { to: string; code: string }): Promise<void> {
  const { to, code } = input;
  const bookingUrl = `${SITE_URL}/stay?invite=${encodeURIComponent(code)}`;
  const subject = '[TDF 2026] Your Stay Booking Invite Code / 您的住宿預約邀請碼';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 22px;">Taiwan Digital Fest 2026</h1>
  </div>

  <div style="background-color: #f9f9f9; padding: 28px; border-radius: 8px;">
    <h2 style="color: #1E1F1C; margin-top: 0; font-size: 18px;">您的住宿預約邀請碼</h2>
    <p>您好，</p>
    <p>感謝您支持 Taiwan Digital Fest 2026。以下是您的合作住宿預約邀請碼，請於預約時填入：</p>
    <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px; background:#fff; padding:12px 16px; border:1px solid #e5e7eb; border-radius:6px; display:inline-block; letter-spacing:1px;">${code}</p>
    <p style="margin-top: 24px;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">立即預約 / Book Now</a>
    </p>
    <p style="color:#666; font-size: 13px;">若按鈕無法使用，請複製以下連結：<br><span style="word-break:break-all;">${bookingUrl}</span></p>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin: 28px 0;">

    <h2 style="color: #1E1F1C; margin-top: 0; font-size: 18px;">Your Stay Booking Invite Code</h2>
    <p>Hi,</p>
    <p>Thanks for supporting Taiwan Digital Fest 2026. Below is your invite code for the partner stay booking. Enter it during checkout:</p>
    <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px; background:#fff; padding:12px 16px; border:1px solid #e5e7eb; border-radius:6px; display:inline-block; letter-spacing:1px;">${code}</p>
    <p style="margin-top: 24px;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Book Now</a>
    </p>
    <p style="color:#666; font-size: 13px;">If the button doesn't work, copy this link:<br><span style="word-break:break-all;">${bookingUrl}</span></p>

    <p style="color:#666; font-size: 13px; margin-top: 24px;">Taiwan Digital Fest 2026 Team</p>
  </div>
</body>
</html>
`.trim();

  const text = `Taiwan Digital Fest 2026

【中文】
您好，

感謝您支持 Taiwan Digital Fest 2026。以下是您的合作住宿預約邀請碼：

  ${code}

請於預約時填入此邀請碼，或直接點擊下方連結（連結中已帶入邀請碼）：
${bookingUrl}

------------------------------------------------------------

[English]
Hi,

Thanks for supporting Taiwan Digital Fest 2026. Below is your invite code for the partner stay booking:

  ${code}

Enter the code during checkout, or open the link below (the code is already pre-filled):
${bookingUrl}

— Taiwan Digital Fest 2026 Team
`;

  await sendStayEmail({ to, subject, html, text, emailType: 'stay_invite_code' });
}
