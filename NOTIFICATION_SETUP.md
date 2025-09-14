# Notification System Setup Guide

This guide explains how to set up both email and browser push notifications for the Premier League Predictions app.

## 📧 Email Notifications

### Backend Setup

1. **Install Dependencies** (already added to package.json):
   ```bash
   npm install nodemailer node-cron
   npm install --save-dev @types/nodemailer @types/node-cron
   ```

2. **Environment Variables** - Add to your `.env` file:
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

3. **Gmail Setup** (Recommended):
   - Enable 2-Factor Authentication on your Gmail account
   - Generate an App Password: Google Account → Security → 2-Step Verification → App passwords
   - Use the 16-character app password as `EMAIL_PASS`

### How Email Notifications Work

- **Automatic Scheduling**: Runs every hour checking for fixtures with deadlines exactly 24 hours away
- **User Targeting**: Sends to all registered users
- **Gameweek Focus**: Groups by gameweek and sends reminders for the first match deadline
- **Rich HTML Emails**: Beautiful templates with match details and direct links

### Testing Email Notifications

```bash
# Test connection
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/notifications/test-connection

# Send test email
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/notifications/test-email
```

## 🔔 Browser Push Notifications

### Frontend Setup

1. **Service Worker**: The `sw.js` file is already created in the frontend `src` folder
2. **Notification Service**: `NotificationService` handles browser notifications
3. **Permission Component**: `NotificationPermissionComponent` provides UI for requesting permissions

### How Browser Notifications Work

- **Permission Request**: Users can enable notifications through the UI
- **Local Notifications**: Shows immediate notifications for reminders
- **Service Worker**: Handles push notifications (requires VAPID keys for production)
- **Click Handling**: Opens the app when notifications are clicked

### Testing Browser Notifications

1. **Enable Notifications**: Use the permission component on the predictions page
2. **Test Notification**: Click the "Test Notification" button
3. **Check Console**: Look for service worker registration logs

## 🚀 Production Setup

### Email (Production)

For production, consider using a dedicated email service:

- **SendGrid**: Professional email delivery
- **Mailgun**: Developer-friendly email API
- **Amazon SES**: Cost-effective for high volume

Example SendGrid setup:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

### Browser Notifications (Production)

For production push notifications, you need:

1. **VAPID Keys**: Generate with `npx web-push generate-vapid-keys`
2. **Service Worker**: Update the VAPID public key in `sw.js`
3. **Backend Integration**: Add push subscription storage and sending

## 📱 Mobile Considerations

### Progressive Web App (PWA)

To make this a PWA with notifications:

1. **Add Manifest**: Create `manifest.json` for app installation
2. **Service Worker**: Already implemented
3. **Offline Support**: Add caching strategies
4. **App Icons**: Add various icon sizes

### iOS Safari

- iOS Safari has limited notification support
- Consider email as primary notification method
- PWA installation works on iOS 11.3+

## 🔧 Troubleshooting

### Email Issues

**Not sending emails:**
- Check SMTP credentials
- Verify 2FA is enabled (Gmail)
- Use app passwords, not regular passwords
- Check firewall/network restrictions

**Connection issues:**
- Verify SMTP host and port
- Test with different email provider
- Check if provider blocks automated emails

### Browser Notification Issues

**Permission denied:**
- Clear browser data and try again
- Check browser notification settings
- Test in incognito mode

**Service worker not registering:**
- Ensure `sw.js` is in the root of your build
- Check browser console for errors
- Verify HTTPS in production

**Notifications not showing:**
- Check if notifications are enabled in browser
- Verify service worker is active
- Test with simple notification first

## 📊 Monitoring

### Email Monitoring

- Check server logs for email sending status
- Monitor bounce rates and delivery
- Track user engagement with email links

### Browser Notification Monitoring

- Track permission grant rates
- Monitor notification click rates
- Check service worker registration success

## 🎯 Features Implemented

### ✅ Completed

- [x] Email service with nodemailer
- [x] Automated scheduling with node-cron
- [x] Beautiful HTML email templates
- [x] Browser notification service
- [x] Permission request UI
- [x] Service worker for push notifications
- [x] Test endpoints for both systems
- [x] Comprehensive error handling

### 🔄 Future Enhancements

- [ ] VAPID keys for production push notifications
- [ ] Push subscription storage in database
- [ ] User notification preferences
- [ ] Email unsubscribe functionality
- [ ] Notification analytics dashboard
- [ ] SMS notifications integration
- [ ] WhatsApp notifications
- [ ] Slack/Discord bot integration

## 📞 Support

If you encounter issues:

1. Check the logs in both frontend and backend
2. Verify environment variables are set correctly
3. Test with simple examples first
4. Check browser compatibility
5. Review email provider documentation

The notification system is designed to be robust and user-friendly, providing multiple ways to keep users engaged with the Premier League Predictions app!
