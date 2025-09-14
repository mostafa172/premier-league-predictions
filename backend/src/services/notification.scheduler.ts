import * as cron from 'node-cron';
import { Fixture } from '../models/Fixture';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { emailService, NotificationEmailData } from './email.service';
import { Op } from 'sequelize';

export class NotificationScheduler {
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.initializeScheduler();
  }

  private initializeScheduler(): void {
    // Run every hour to check for users who need reminders
    // This checks for users who should receive reminders exactly 24 hours before the first match deadline
    this.cronJob = cron.schedule('0 * * * *', async () => {
      console.log('Running notification scheduler check...');
      await this.checkAndSendReminders();
    });

    console.log('Notification scheduler initialized - checking every hour for 24h reminders');
  }

  private async checkAndSendReminders(): Promise<void> {
    try {
      // Get the current time and 24 hours from now
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find gameweeks where the first match deadline is exactly 24 hours away
      const upcomingFixtures = await Fixture.findAll({
        where: {
          status: 'upcoming',
          deadline: {
            [Op.between]: [in24Hours, new Date(in24Hours.getTime() + 60 * 60 * 1000)] // Within 1 hour window
          }
        },
        include: [
          {
            model: Team,
            as: 'homeTeam',
            attributes: ['name', 'abbreviation']
          },
          {
            model: Team,
            as: 'awayTeam',
            attributes: ['name', 'abbreviation']
          }
        ],
        order: [['deadline', 'ASC']]
      });

      if (upcomingFixtures.length === 0) {
        console.log('No fixtures with deadlines in 24 hours found');
        return;
      }

      // Group fixtures by gameweek and find the earliest deadline for each gameweek
      const gameweekFirstDeadlines = new Map<number, { fixture: Fixture, deadline: Date }>();

      for (const fixture of upcomingFixtures) {
        const gameweek = fixture.gameweek;
        const existing = gameweekFirstDeadlines.get(gameweek);
        
        if (!existing || fixture.deadline < existing.deadline) {
          gameweekFirstDeadlines.set(gameweek, { fixture, deadline: fixture.deadline });
        }
      }

      // For each gameweek with a 24-hour deadline approaching, send reminders
      for (const [gameweek, { fixture }] of gameweekFirstDeadlines) {
        await this.sendGameweekReminders(gameweek, fixture);
      }

    } catch (error) {
      console.error('Error in notification scheduler:', error);
    }
  }

  private async sendGameweekReminders(gameweek: number, firstFixture: Fixture): Promise<void> {
    try {
      // Get all users who have made predictions before (active users)
      const users = await User.findAll({
        attributes: ['id', 'username', 'email']
      });

      const firstMatchTeams = `${firstFixture.homeTeam?.name} vs ${firstFixture.awayTeam?.name}`;

      console.log(`Sending Gameweek ${gameweek} reminders to ${users.length} users`);

      // Send reminder to each user
      for (const user of users) {
        const emailData: NotificationEmailData = {
          userEmail: user.email,
          username: user.username,
          gameweek,
          firstMatchDate: firstFixture.matchDate,
          firstMatchTeams,
          deadline: firstFixture.deadline
        };

        const success = await emailService.sendPredictionReminder(emailData);
        if (success) {
          console.log(`✅ Reminder sent to ${user.username} (${user.email}) for Gameweek ${gameweek}`);
        } else {
          console.log(`❌ Failed to send reminder to ${user.username} (${user.email}) for Gameweek ${gameweek}`);
        }

        // Add a small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Completed sending Gameweek ${gameweek} reminders`);

    } catch (error) {
      console.error(`Error sending Gameweek ${gameweek} reminders:`, error);
    }
  }

  // Method to manually trigger reminders for testing
  public async sendTestReminder(userEmail: string, username: string = 'Test User'): Promise<boolean> {
    const testData: NotificationEmailData = {
      userEmail,
      username,
      gameweek: 1,
      firstMatchDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
      firstMatchTeams: 'Arsenal vs Chelsea',
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };

    return await emailService.sendPredictionReminder(testData);
  }

  // Method to stop the scheduler
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Notification scheduler stopped');
    }
  }

  // Method to start the scheduler
  public start(): void {
    if (this.cronJob) {
      this.cronJob.start();
      console.log('Notification scheduler started');
    }
  }
}

export const notificationScheduler = new NotificationScheduler();
