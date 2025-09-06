import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsEvent {
  eventType: 'config_started' | 'option_selected' | 'config_completed' | 'config_abandoned' | 'price_viewed' | 'recommendation_applied';
  productId: string;
  sessionId: string;
  configurationData?: any;
  optionId?: string;
  valueId?: string;
  timestamp: Date;
  userAgent: string;
  metadata?: any;
}

export interface ConfigurationSession {
  sessionId: string;
  productId: string;
  startTime: Date;
  currentConfiguration: any;
  completionRate: number;
  abandononmentPoint?: string;
  events: AnalyticsEvent[];
}

class AnalyticsTracker {
  private currentSession: ConfigurationSession | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushInterval();
    this.trackPageUnload();
  }

  // Start a new configuration session
  startSession(productId: string): string {
    const sessionId = this.generateSessionId();
    
    this.currentSession = {
      sessionId,
      productId,
      startTime: new Date(),
      currentConfiguration: {},
      completionRate: 0,
      events: []
    };

    this.trackEvent({
      eventType: 'config_started',
      productId,
      sessionId,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    });

    return sessionId;
  }

  // Track configuration events
  trackEvent(event: AnalyticsEvent) {
    if (this.currentSession) {
      this.currentSession.events.push(event);
      this.updateCompletionRate();
    }
    
    this.eventQueue.push(event);
    
    // Flush immediately for critical events
    if (['config_completed', 'config_abandoned'].includes(event.eventType)) {
      this.flush();
    }
  }

  // Track option selection
  trackOptionSelection(productId: string, optionId: string, valueId: string, currentConfig: any) {
    if (!this.currentSession) return;

    this.currentSession.currentConfiguration = currentConfig;
    
    this.trackEvent({
      eventType: 'option_selected',
      productId,
      sessionId: this.currentSession.sessionId,
      optionId,
      valueId,
      configurationData: currentConfig,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      metadata: {
        totalOptions: Object.keys(currentConfig).length,
        sessionDuration: Date.now() - this.currentSession.startTime.getTime()
      }
    });
  }

  // Track configuration completion
  trackCompletion(productId: string, finalConfiguration: any, totalPrice: number) {
    if (!this.currentSession) return;

    this.trackEvent({
      eventType: 'config_completed',
      productId,
      sessionId: this.currentSession.sessionId,
      configurationData: finalConfiguration,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      metadata: {
        totalPrice,
        sessionDuration: Date.now() - this.currentSession.startTime.getTime(),
        totalSelections: Object.keys(finalConfiguration).length
      }
    });

    this.currentSession.completionRate = 100;
    this.endSession();
  }

  // Track configuration abandonment
  trackAbandonment(reason?: string) {
    if (!this.currentSession) return;

    const abandononmentPoint = this.getAbandonmentPoint();
    
    this.trackEvent({
      eventType: 'config_abandoned',
      productId: this.currentSession.productId,
      sessionId: this.currentSession.sessionId,
      configurationData: this.currentSession.currentConfiguration,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      metadata: {
        reason,
        abandononmentPoint,
        sessionDuration: Date.now() - this.currentSession.startTime.getTime(),
        completionRate: this.currentSession.completionRate
      }
    });

    this.currentSession.abandononmentPoint = abandononmentPoint;
    this.endSession();
  }

  // Track price views and interactions
  trackPriceView(productId: string, currentPrice: number, priceBreakdown: any) {
    if (!this.currentSession) return;

    this.trackEvent({
      eventType: 'price_viewed',
      productId,
      sessionId: this.currentSession.sessionId,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      metadata: {
        currentPrice,
        priceBreakdown,
        configurationState: this.currentSession.currentConfiguration
      }
    });
  }

  // Track recommendation application
  trackRecommendationApplied(productId: string, recommendationType: string, optionId: string, valueId: string) {
    if (!this.currentSession) return;

    this.trackEvent({
      eventType: 'recommendation_applied',
      productId,
      sessionId: this.currentSession.sessionId,
      optionId,
      valueId,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      metadata: {
        recommendationType,
        sessionDuration: Date.now() - this.currentSession.startTime.getTime(),
        currentConfiguration: this.currentSession.currentConfiguration
      }
    });
  }

  // Update completion rate based on current progress
  private updateCompletionRate() {
    if (!this.currentSession) return;

    // Get product configuration requirements
    const totalRequiredOptions = this.getTotalRequiredOptions();
    const completedOptions = Object.keys(this.currentSession.currentConfiguration).length;
    
    this.currentSession.completionRate = totalRequiredOptions > 0 
      ? Math.min(100, (completedOptions / totalRequiredOptions) * 100)
      : 0;
  }

  // Get total required options (would need product data)
  private getTotalRequiredOptions(): number {
    // This would be calculated based on the product's required options
    // For now, return a default value
    return 5;
  }

  // Determine where user abandoned the configuration
  private getAbandonmentPoint(): string {
    if (!this.currentSession) return 'unknown';

    const events = this.currentSession.events;
    const lastEvent = events[events.length - 1];
    
    if (lastEvent?.eventType === 'option_selected') {
      return `option_${lastEvent.optionId}`;
    } else if (lastEvent?.eventType === 'price_viewed') {
      return 'price_review';
    } else if (lastEvent?.eventType === 'config_started') {
      return 'initial_view';
    }
    
    return 'unknown';
  }

  // End current session
  private endSession() {
    if (this.currentSession) {
      this.saveSessionToDatabase(this.currentSession);
      this.currentSession = null;
    }
  }

  // Save session data to database
  private async saveSessionToDatabase(session: ConfigurationSession) {
    try {
      const { error } = await supabase
        .from('configuration_analytics')
        .insert({
          product_id: session.productId,
          session_id: session.sessionId,
          configuration_data: session.currentConfiguration,
          completion_rate: session.completionRate,
          abandonment_point: session.abandononmentPoint,
          user_agent: navigator.userAgent
        });

      if (error) {
        console.error('Error saving analytics:', error);
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  // Flush event queue to server
  private async flush() {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Here you would send events to your analytics service
      // For now, we'll just log them
      console.log('Flushing analytics events:', eventsToFlush);
      
      // You could also save individual events to a separate table
      // or send them to external analytics services like Google Analytics, Mixpanel, etc.
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // Re-add events to queue for retry
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  // Start periodic flush
  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // Flush every 30 seconds
  }

  // Track page unload to catch abandonment
  private trackPageUnload() {
    window.addEventListener('beforeunload', () => {
      if (this.currentSession && this.currentSession.completionRate < 100) {
        this.trackAbandonment('page_unload');
        this.flush(); // Immediate flush before page unloads
      }
    });

    // Also track visibility changes (tab switching, etc.)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentSession) {
        this.flush();
      }
    });
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    if (this.currentSession) {
      this.trackAbandonment('cleanup');
      this.endSession();
    }
    
    this.flush();
  }
}

// Export singleton instance
export const analyticsTracker = new AnalyticsTracker();

// Analytics insights and reporting
export const getAnalyticsInsights = async (productId: string, days: number = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('configuration_analytics')
    .select('*')
    .eq('product_id', productId)
    .gte('created_at', startDate.toISOString());

  if (error) throw error;

  // Calculate insights
  const totalSessions = data.length;
  const completedSessions = data.filter(s => s.completion_rate === 100).length;
  const averageCompletionRate = data.reduce((sum, s) => sum + s.completion_rate, 0) / totalSessions;
  
  const abandonmentPoints = data
    .filter(s => s.abandonment_point)
    .reduce((acc, s) => {
      acc[s.abandonment_point] = (acc[s.abandonment_point] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

  const mostPopularOptions = {};
  data.forEach(session => {
    if (session.configuration_data) {
      Object.entries(session.configuration_data).forEach(([optionId, valueId]) => {
        const key = `${optionId}:${valueId}`;
        mostPopularOptions[key] = (mostPopularOptions[key] || 0) + 1;
      });
    }
  });

  return {
    totalSessions,
    completedSessions,
    completionRate: completedSessions / totalSessions,
    averageCompletionRate,
    abandonmentPoints,
    mostPopularOptions,
    insights: {
      conversionRate: (completedSessions / totalSessions) * 100,
      dropOffRate: ((totalSessions - completedSessions) / totalSessions) * 100,
      topAbandonmentPoint: Object.entries(abandonmentPoints)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
    }
  };
};