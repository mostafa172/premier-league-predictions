# Email Notification Setup

This document explains how to configure email notifications for the Premier League Predictions app.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=Premier League Predictions <your_email@gmail.com>

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:4200
```

## Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password as `EMAIL_PASS`

3. **Configure your .env**:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_16_character_app_password
   EMAIL_FROM=Premier League Predictions <your_gmail@gmail.com>
   ```

## Other Email Providers

### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

### Yahoo
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

### Custom SMTP
```env
EMAIL_HOST=your.smtp.server.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

## Testing Email Configuration

1. **Start the server** with email configuration
2. **Test the connection**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:3000/api/notifications/test-connection
   ```

3. **Send a test email**:
   ```bash
   curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:3000/api/notifications/test-email
   ```

## How It Works

- **Automatic Reminders**: The system checks every hour for fixtures with deadlines exactly 24 hours away
- **User Targeting**: Sends reminders to all registered users
- **Gameweek Focus**: Groups fixtures by gameweek and sends reminders for the first match deadline
- **Rich HTML Emails**: Beautiful, responsive email templates with match details and direct links

## Notification Schedule

- **Frequency**: Every hour
- **Timing**: Exactly 24 hours before the first match deadline in each gameweek
- **Content**: Gameweek number, first match details, deadline, and direct link to predictions page

## Troubleshooting

### Email not sending
1. Check your email credentials
2. Verify 2FA is enabled (for Gmail)
3. Use app passwords, not regular passwords
4. Check firewall/network restrictions

### Connection issues
1. Verify SMTP host and port
2. Check if your email provider blocks automated emails
3. Test with a different email provider

### Scheduler not running
1. Check server logs for initialization messages
2. Verify database connection
3. Ensure fixtures exist with proper deadlines
