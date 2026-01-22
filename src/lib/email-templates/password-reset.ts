export const getPasswordResetEmailTemplate = (resetUrl: string, userName?: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 40px 20px;">
    <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
        <!-- Header with Logo -->
        <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%); padding: 40px 30px; text-align: center;">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Password Reset Request</h1>
            </td>
        </tr>

        <!-- Content -->
        <tr>
            <td style="padding: 40px 30px;">
                ${userName ? `<p style="margin: 0 0 20px; font-size: 16px; color: #1f2937; line-height: 1.6;">Hi <strong>${userName}</strong>,</p>` : ''}

                <p style="margin: 0 0 20px; font-size: 16px; color: #1f2937; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to create a new password:
                </p>

                <!-- Reset Button -->
                <table role="presentation" style="margin: 30px 0;">
                    <tr>
                        <td style="text-align: center;">
                            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: transform 0.2s;">
                                Reset Password
                            </a>
                        </td>
                    </tr>
                </table>

                <!-- Info Box -->
                <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 30px 0;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #1e40af; font-weight: 600;">
                        ⏰ This link expires in 30 minutes
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #1e3a8a; line-height: 1.5;">
                        For security reasons, this password reset link will only work once and expires in 30 minutes.
                    </p>
                </div>

                <!-- Alternative Link -->
                <p style="margin: 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 20px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; word-break: break-all; font-size: 13px; color: #3b82f6;">
                    ${resetUrl}
                </p>

                <!-- Security Notice -->
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 30px 0;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #991b1b; font-weight: 600;">
                        🔒 Security Notice
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5;">
                        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                    </p>
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                    This is an automated message, please do not reply.
                </p>
                <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                    © ${new Date().getFullYear()} Blue Ice Software. All rights reserved.
                </p>
            </td>
        </tr>
    </table>

    <!-- Additional spacing for email clients -->
    <div style="height: 40px;"></div>
</body>
</html>
  `.trim();
};
