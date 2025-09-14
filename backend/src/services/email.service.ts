import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface NotificationEmailData {
  userEmail: string;
  username: string;
  gameweek: number;
  firstMatchDate: Date;
  firstMatchTeams: string;
  deadline: Date;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    // Check if email configuration is available
    const emailConfig = this.getEmailConfig();
    if (!emailConfig) {
      console.warn('Email configuration not found. Email notifications will be disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter(emailConfig);
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  private getEmailConfig(): EmailConfig | null {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const secure = process.env.EMAIL_SECURE === 'true';

    if (!host || !port || !user || !pass) {
      return null;
    }

    return {
      host,
      port: parseInt(port),
      secure,
      auth: { user, pass }
    };
  }

  public async sendPredictionReminder(data: NotificationEmailData): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not available. Cannot send reminder email.');
      return false;
    }

    const subject = `Premier League Predictions - Gameweek ${data.gameweek} Reminder`;
    const htmlContent = this.generateReminderEmailHTML(data);

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: data.userEmail,
        subject,
        html: htmlContent,
      });

      console.log(`Reminder email sent successfully to ${data.userEmail} for Gameweek ${data.gameweek}`);
      return true;
    } catch (error) {
      console.error(`Failed to send reminder email to ${data.userEmail}:`, error);
      return false;
    }
  }

  private generateReminderEmailHTML(data: NotificationEmailData): string {
    const deadlineFormatted = data.deadline.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const matchDateFormatted = data.firstMatchDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Premier League Predictions Reminder</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .match-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e3c72; }
            .deadline-warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background: #1e3c72; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⚽ Premier League Predictions</h1>
            <h2>Gameweek ${data.gameweek} Reminder</h2>
        </div>
        
        <div class="content">
            <p>Hi <strong>${data.username}</strong>,</p>
            
            <p>Don't forget to make your predictions for Gameweek ${data.gameweek}!</p>
            
            <div class="match-info">
                <h3>First Match of Gameweek ${data.gameweek}</h3>
                <p><strong>${data.firstMatchTeams}</strong></p>
                <p>📅 <strong>Match Date:</strong> ${matchDateFormatted}</p>
                <p>⏰ <strong>Prediction Deadline:</strong> ${deadlineFormatted}</p>
            </div>
            
            <div class="deadline-warning">
                <p><strong>⚠️ Important:</strong> You have exactly 24 hours left to submit your predictions before the deadline!</p>
            </div>
            
            <p>Make sure to:</p>
            <ul>
                <li>Predict the score for each match</li>
                <li>Choose your double points fixture (only one per gameweek!)</li>
                <li>Submit before the deadline to avoid missing out on points</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/predictions" class="button">
                    Make Your Predictions Now
                </a>
            </div>
            
            <p>Good luck with your predictions!</p>
        </div>
        
        <div class="footer">
            <p>This is an automated reminder from Premier League Predictions.</p>
            <p>If you no longer wish to receive these reminders, please contact support.</p>
        </div>
    </body>
    </html>
    `;
  }

  public async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
