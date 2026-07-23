import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import notificationService from '@/lib/notificationService';
import { buildApiUrl } from '@/lib/config';

export interface Notification {
  id: string;
  type: 'new_lead' | 'credit_application' | 'finance_deal' | 'signature_request' | 'message' | 'general';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(buildApiUrl('/notifications'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        
        // Count unread notifications
        const unread = (data.notifications || []).filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
        
        // Count unread messages specifically
        const messages = (data.notifications || []).filter(
          (n: Notification) => n.type === 'message' && !n.read
        ).length;
        setMessagesCount(messages);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/notifications/${notificationId}/read`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/notifications/mark-all-read'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true }))
        );
        setUnreadCount(0);
        setMessagesCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/notifications/${notificationId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    if (!user) return;

    // Custom event listener for new notifications
    const handleNewNotification = (event: any) => {
      const newNotification = event.detail;
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (newNotification.type === 'message') {
        setMessagesCount(prev => prev + 1);
      }
    };

    window.addEventListener('new-notification', handleNewNotification);

    // Initial fetch
    fetchNotifications();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      window.removeEventListener('new-notification', handleNewNotification);
      clearInterval(interval);
    };
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    messagesCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};

