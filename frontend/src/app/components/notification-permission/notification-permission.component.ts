import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService, NotificationPermission } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-permission',
  templateUrl: './notification-permission.component.html',
  styleUrls: ['./notification-permission.component.scss']
})
export class NotificationPermissionComponent implements OnInit, OnDestroy {
  permission: NotificationPermission = {
    granted: false,
    denied: false,
    default: false
  };

  isSupported = false;
  requesting = false;
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.isSupported = this.notificationService.isSupported();
    
    this.subscription.add(
      this.notificationService.permission$.subscribe(permission => {
        this.permission = permission;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  async requestPermission(): Promise<void> {
    if (this.requesting) return;

    this.requesting = true;
    try {
      await this.notificationService.requestPermission();
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      this.requesting = false;
    }
  }

  showTestNotification(): void {
    this.notificationService.showTestNotification();
  }

  get shouldShowRequestButton(): boolean {
    return this.isSupported && this.permission.default;
  }

  get shouldShowGrantedMessage(): boolean {
    return this.isSupported && this.permission.granted;
  }

  get shouldShowDeniedMessage(): boolean {
    return this.isSupported && this.permission.denied;
  }

  get shouldShowNotSupportedMessage(): boolean {
    return !this.isSupported;
  }
}
