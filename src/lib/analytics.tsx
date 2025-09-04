"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Clock, 
  Bot, 
  TrendingUp, 
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";

// Analytics event types
export type AnalyticsEvent = {
  id: string;
  type: 'message_sent' | 'message_received' | 'conversation_started' | 'provider_changed' | 'error_occurred';
  timestamp: Date;
  data: {
    provider?: string;
    messageLength?: number;
    responseTime?: number;
    errorType?: string;
    conversationId?: string;
    [key: string]: unknown;
  };
};

// Analytics storage interface
interface AnalyticsStorage {
  events: AnalyticsEvent[];
  lastCleanup: Date;
}

// Usage statistics
interface UsageStats {
  totalMessages: number;
  totalConversations: number;
  averageMessageLength: number;
  averageResponseTime: number;
  mostUsedProvider: string;
  todayMessages: number;
  weeklyMessages: number;
  errorRate: number;
  providerStats: Record<string, number>;
  hourlyActivity: Record<string, number>;
  responseTimeStats: {
    min: number;
    max: number;
    average: number;
  };
}

// Rate limiting configuration
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

class AnalyticsService {
  private static readonly STORAGE_KEY = 'mds-chatbot-analytics';
  private static readonly MAX_EVENTS = 1000; // Keep last 1000 events
  private static readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static trackEvent(type: AnalyticsEvent['type'], data: AnalyticsEvent['data'] = {}) {
    try {
      const event: AnalyticsEvent = {
        id: Date.now().toString() + Math.random(),
        type,
        timestamp: new Date(),
        data
      };

      const storage = this.getStorage();
      storage.events.push(event);

      // Keep only the most recent events
      if (storage.events.length > this.MAX_EVENTS) {
        storage.events = storage.events.slice(-this.MAX_EVENTS);
      }

      this.saveStorage(storage);
      this.maybeCleanup(storage);
    } catch (error) {
      console.warn('Failed to track analytics event:', error);
    }
  }

  static getStats(): UsageStats {
    const storage = this.getStorage();
    const events = storage.events;
    
    if (events.length === 0) {
      return this.getEmptyStats();
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const messagesSent = events.filter(e => e.type === 'message_sent');
    const messagesReceived = events.filter(e => e.type === 'message_received');
    const conversations = events.filter(e => e.type === 'conversation_started');
    const errors = events.filter(e => e.type === 'error_occurred');

    const todayMessages = messagesSent.filter(e => e.timestamp >= todayStart).length;
    const weeklyMessages = messagesSent.filter(e => e.timestamp >= weekStart).length;

    const messageLengths = messagesSent
      .map(e => e.data.messageLength)
      .filter(Boolean) as number[];
    
    const responseTimes = messagesReceived
      .map(e => e.data.responseTime)
      .filter(Boolean) as number[];

    const providerStats: Record<string, number> = {};
    messagesSent.forEach(e => {
      const provider = e.data.provider || 'unknown';
      providerStats[provider] = (providerStats[provider] || 0) + 1;
    });

    const hourlyActivity: Record<string, number> = {};
    events.forEach(e => {
      const hour = e.timestamp.getHours().toString();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    const mostUsedProvider = Object.entries(providerStats)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    return {
      totalMessages: messagesSent.length,
      totalConversations: new Set(conversations.map(e => e.data.conversationId)).size,
      averageMessageLength: messageLengths.length > 0 
        ? Math.round(messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length)
        : 0,
      averageResponseTime: responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0,
      mostUsedProvider,
      todayMessages,
      weeklyMessages,
      errorRate: messagesSent.length > 0 ? Math.round((errors.length / messagesSent.length) * 100) : 0,
      providerStats,
      hourlyActivity,
      responseTimeStats: {
        min: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        max: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        average: responseTimes.length > 0 
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0
      }
    };
  }

  static getRateLimit(config: RateLimitConfig) {
    const storage = this.getStorage();
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentMessages = storage.events.filter(e => 
      e.type === 'message_sent' && e.timestamp >= oneMinuteAgo
    );
    const hourlyMessages = storage.events.filter(e => 
      e.type === 'message_sent' && e.timestamp >= oneHourAgo
    );
    const dailyMessages = storage.events.filter(e => 
      e.type === 'message_sent' && e.timestamp >= oneDayAgo
    );

    return {
      withinMinuteLimit: recentMessages.length < config.maxRequestsPerMinute,
      withinHourLimit: hourlyMessages.length < config.maxRequestsPerHour,
      withinDayLimit: dailyMessages.length < config.maxRequestsPerDay,
      current: {
        perMinute: recentMessages.length,
        perHour: hourlyMessages.length,
        perDay: dailyMessages.length
      },
      limits: config
    };
  }

  static clearData() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear analytics data:', error);
    }
  }

  private static getStorage(): AnalyticsStorage {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          events: parsed.events.map((e: unknown) => ({
            ...(e as { timestamp: string }),
            timestamp: new Date((e as { timestamp: string }).timestamp)
          })),
          lastCleanup: new Date(parsed.lastCleanup)
        };
      }
    } catch (error) {
      console.warn('Failed to load analytics data:', error);
    }

    return {
      events: [],
      lastCleanup: new Date()
    };
  }

  private static saveStorage(storage: AnalyticsStorage) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storage));
    } catch (error) {
      console.warn('Failed to save analytics data:', error);
    }
  }

  private static maybeCleanup(storage: AnalyticsStorage) {
    const now = new Date();
    if (now.getTime() - storage.lastCleanup.getTime() > this.CLEANUP_INTERVAL) {
      // Remove events older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      storage.events = storage.events.filter(e => e.timestamp > thirtyDaysAgo);
      storage.lastCleanup = now;
      this.saveStorage(storage);
    }
  }

  private static getEmptyStats(): UsageStats {
    return {
      totalMessages: 0,
      totalConversations: 0,
      averageMessageLength: 0,
      averageResponseTime: 0,
      mostUsedProvider: 'none',
      todayMessages: 0,
      weeklyMessages: 0,
      errorRate: 0,
      providerStats: {},
      hourlyActivity: {},
      responseTimeStats: { min: 0, max: 0, average: 0 }
    };
  }
}

// React hook for using analytics
export function useAnalytics() {
  const [stats, setStats] = useState<UsageStats>(() => AnalyticsService.getStats());

  const trackEvent = useCallback((type: AnalyticsEvent['type'], data?: AnalyticsEvent['data']) => {
    AnalyticsService.trackEvent(type, data);
    setStats(AnalyticsService.getStats());
  }, []);

  const refreshStats = useCallback(() => {
    setStats(AnalyticsService.getStats());
  }, []);

  const clearData = useCallback(() => {
    AnalyticsService.clearData();
    setStats(AnalyticsService.getStats());
  }, []);

  const checkRateLimit = useCallback((config: RateLimitConfig) => {
    return AnalyticsService.getRateLimit(config);
  }, []);

  return {
    stats,
    trackEvent,
    refreshStats,
    clearData,
    checkRateLimit
  };
}

// Analytics Dashboard Component
interface AnalyticsDashboardProps {
  className?: string;
}

export default function AnalyticsDashboard({ className = "" }: AnalyticsDashboardProps) {
  const { stats, clearData } = useAnalytics();

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <button
          onClick={clearData}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Clear Data
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.totalMessages}</p>
              <p className="text-sm text-muted-foreground">Total Messages</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.totalConversations}</p>
              <p className="text-sm text-muted-foreground">Conversations</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{formatTime(stats.averageResponseTime)}</p>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.todayMessages}</p>
               <p className="text-sm text-muted-foreground">Today&apos;s Messages</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Usage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Provider Usage
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.providerStats).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{provider}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((count / stats.totalMessages) * 100)}%
                  </span>
                </div>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Stats */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Message Length</span>
              <span className="font-medium">{stats.averageMessageLength} chars</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Error Rate</span>
              <span className="font-medium">{stats.errorRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Weekly Messages</span>
              <span className="font-medium">{stats.weeklyMessages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Most Used Provider</span>
              <Badge variant="secondary">{stats.mostUsedProvider}</Badge>
            </div>
          </div>
        </Card>

        {/* Response Time Stats */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Response Times
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Fastest</span>
              <span className="font-medium text-green-600">
                {formatTime(stats.responseTimeStats.min)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Average</span>
              <span className="font-medium">
                {formatTime(stats.responseTimeStats.average)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Slowest</span>
              <span className="font-medium text-red-600">
                {formatTime(stats.responseTimeStats.max)}
              </span>
            </div>
          </div>
        </Card>

        {/* Activity Heatmap */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Hourly Activity
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 24 }, (_, hour) => {
              const activity = stats.hourlyActivity[hour.toString()] || 0;
              const maxActivity = Math.max(...Object.values(stats.hourlyActivity));
              const intensity = maxActivity > 0 ? activity / maxActivity : 0;
              
              return (
                <div
                  key={hour}
                  className="aspect-square rounded text-xs flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                    color: intensity > 0.5 ? 'white' : 'black'
                  }}
                  title={`${hour}:00 - ${activity} events`}
                >
                  {hour}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export { AnalyticsService };
