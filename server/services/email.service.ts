import { Resend } from "resend";
import { logger } from "../logger";

// Initialize Resend lazily
let resendInstance: Resend | null = null;

const getResend = () => {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY;
    if (!key || key === "re_xxxxxxxxx") {
      logger.warn("RESEND_API_KEY is not configured or using placeholder");
      return null;
    }
    resendInstance = new Resend(key);
  }
  return resendInstance;
};

export class EmailService {
  /**
   * Send an OTP email to a user.
   * Gated by EMAIL_OTP_ENABLED environment variable.
   */
  async sendOTPEmail(to: string, otp: string): Promise<boolean> {
    const isMockEnv = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "sandbox";

    if (process.env.EMAIL_OTP_ENABLED !== "true") {
      logger.info("Email OTP is disabled; skipping email send", { to, otp });
      return true;
    }

    if (isMockEnv) {
      logger.info("MOCK ENVIRONMENT: Skipping real email send. Use static code.", { to, otp });
      return true;
    }

    const resend = getResend();
    if (!resend) {
      logger.error("Failed to send email: Resend is not configured");
      return false;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "BerryBank <onboarding@resend.dev>", // Default Resend testing address
        to: [to],
        subject: "Your BerryBank Verification Code",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <h2 style="color: #059669; margin-bottom: 16px;">Verify your identity</h2>
            <p style="font-size: 16px; color: #4b5563; margin-bottom: 24px;">
              Use the following code to complete your verification process. This code will expire in 10 minutes.
            </p>
            <div style="background-color: #f0fdf4; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #059669;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #9ca3af;">
              If you didn't request this code, you can safely ignore this email.
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              &copy; 2026 BerryBank GreenHub. Together for a greener planet.
            </p>
          </div>
        `,
      });

      if (error) {
        logger.error("Resend API error", { error });
        return false;
      }

      logger.info("OTP email sent successfully", { to, emailId: data?.id });
      return true;
    } catch (err) {
      logger.error("Failed to send OTP email", {
        error: err instanceof Error ? err.message : String(err),
        to,
      });
      return false;
    }
  }

  /**
   * Send a general purpose email
   */
  async sendEmail(data: { to: string; subject: string; html: string }): Promise<boolean> {
    const resend = getResend();
    if (!resend) return false;

    try {
      await resend.emails.send({
        from: "BerryBank <onboarding@resend.dev>",
        to: [data.to],
        subject: data.subject,
        html: data.html,
      });
      return true;
    } catch (err) {
      logger.error("Failed to send email", { error: String(err) });
      return false;
    }
  }
}

export const emailService = new EmailService();
