// Frontend notification service for desktop notifications
class NotificationService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor() {
    this.initializeNotifications();
  }

  private async initializeNotifications() {
    // Request notification permission
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Desktop notifications enabled');
        this.connectWebSocket();
      } else {
        console.log('❌ Desktop notifications not permitted');
      }
    } else {
      console.log('❌ Desktop notifications not supported');
    }
  }

  private connectWebSocket() {
    try {
      const token = localStorage.getItem('auth_token');
      const user = this.getCurrentUser();
      
      if (!token || !user) {
        console.log('No auth token or user, skipping WebSocket connection');
        return;
      }

      const wsUrl = `ws://localhost:3000?userId=${user.id}&userRole=${user.role}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected for notifications');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNotification(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connectWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('Max reconnection attempts reached');
    }
  }

  private handleNotification(data: any) {
    if (data.type === 'notification') {
      this.showDesktopNotification(data);
    } else if (data.type === 'connection') {
      console.log('Connected to notification service:', data.message);
    }
  }

  private showDesktopNotification(data: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(data.title, {
        body: data.message,
        icon: '/favicon.ico',
        tag: data.type,
        requireInteraction: true
      });

      notification.onclick = () => {
        // Focus the window and navigate to leads page
        window.focus();
        if (data.type === 'new_lead') {
          window.location.href = '/leads';
        }
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);
    }
  }

  private getCurrentUser() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      // Decode JWT token to get user info
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.userId,
        role: payload.role || 'dealer'
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public isNotificationSupported() {
    return 'Notification' in window;
  }

  public getNotificationPermission() {
    return Notification.permission;
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Export for use in components
export default notificationService; 