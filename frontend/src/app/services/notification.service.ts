import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;
  private permissionSubject = new BehaviorSubject<NotificationPermission>({
    granted: false,
    denied: false,
    default: false
  });

  public permission$ = this.permissionSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkInitialPermission();
  }

  /**
   * Check the current notification permission status
   */
  private checkInitialPermission(): void {
    if ('Notification' in window) {
      const permission = Notification.permission;
      this.updatePermissionState(permission);
    }
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return {
        granted: false,
        denied: true,
        default: false
      };
    }

    if (Notification.permission === 'granted') {
      return {
        granted: true,
        denied: false,
        default: false
      };
    }

    if (Notification.permission === 'denied') {
      return {
        granted: false,
        denied: true,
        default: false
      };
    }

    try {
      const permission = await Notification.requestPermission();
      this.updatePermissionState(permission);
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        await this.subscribeToPushNotifications();
      }

      return this.getPermissionState();
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return {
        granted: false,
        denied: true,
        default: false
      };
    }
  }

  /**
   * Update the permission state based on the current permission
   */
  private updatePermissionState(permission: NotificationPermission): void {
    const state = {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
    this.permissionSubject.next(state);
  }

  /**
   * Get the current permission state
   */
  public getPermissionState(): NotificationPermission {
    return this.permissionSubject.value;
  }

  /**
   * Subscribe to push notifications (if supported)
   */
  private async subscribeToPushNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'YOUR_VAPID_PUBLIC_KEY_HERE' // Replace with your VAPID public key
        )
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      console.log('Push subscription successful');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Note: You'll need to implement the endpoint on your backend
    // await this.http.post(`${this.apiUrl}/subscribe`, subscription, { headers }).toPromise();
  }

  /**
   * Show a local notification
   */
  public showNotification(title: string, options?: NotificationOptions): void {
    if (!this.getPermissionState().granted) {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(title, {
      icon: '/assets/logos/premier-league.png',
      badge: '/assets/logos/premier-league.png',
      requireInteraction: true,
      ...options
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  /**
   * Show prediction reminder notification
   */
  public showPredictionReminder(gameweek: number, firstMatch: string, deadline: Date): void {
    const deadlineFormatted = deadline.toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    this.showNotification(
      `Gameweek ${gameweek} Predictions Due!`,
      {
        body: `${firstMatch} - Deadline: ${deadlineFormatted}`,
        tag: `gameweek-${gameweek}-reminder`,
        actions: [
          {
            action: 'view',
            title: 'Make Predictions'
          }
        ]
      }
    );
  }

  /**
   * Test notification
   */
  public showTestNotification(): void {
    this.showNotification(
      'Premier League Predictions',
      {
        body: 'This is a test notification!',
        tag: 'test-notification'
      }
    );
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Check if notifications are supported
   */
  public isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get notification status from server
   */
  public getNotificationStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`);
  }

  /**
   * Test email service
   */
  public testEmailConnection(): Observable<any> {
    return this.http.get(`${this.apiUrl}/test-connection`);
  }

  /**
   * Send test email
   */
  public sendTestEmail(): Observable<any> {
    return this.http.post(`${this.apiUrl}/test-email`, {});
  }
}
