"use client";

import UnifiedChatInterface from "@/components/unified-chat-interface";


export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <UnifiedChatInterface 
        config={{
          enableStorage: true,
          enableSpeech: true,
          enableHistory: true,
          autoSave: true,
          defaultProvider: "chat-rag-groq",
          maxMessages: 50,
          showProviderBadge: true,
        }}
        onError={(error) => {
          // Log errors for analytics and debugging
          console.error('Chat error:', error);
          if (typeof window !== 'undefined') {
            // Log all error properties for debugging
            (window as any).__lastPageError = error;
          }
          // Defensive: Only send analytics if all properties exist
          if (
            error &&
            typeof error === 'object' &&
            'type' in error &&
            'message' in error &&
            'recoverable' in error
          ) {
            if (typeof window !== 'undefined') {
              import('@/lib/analytics').then(({ AnalyticsService }) => {
                AnalyticsService.trackEvent('error_occurred', {
                  errorType: error.type,
                  message: error.message,
                  recoverable: error.recoverable
                });
              });
            }
          } else {
            console.warn('Malformed error object received in onError:', error);
          }
        }}
        onMessageSent={(message) => {
          // Track message sent events
          if (typeof window !== 'undefined') {
            import('@/lib/analytics').then(({ AnalyticsService }) => {
              AnalyticsService.trackEvent('message_sent', {
                messageLength: message.content.length,
                timestamp: message.timestamp.getTime()
              });
            });
          }
          
          // Optional: Add more detailed logging
          if (process.env.NODE_ENV === 'development') {
            console.log('Message sent:', message.content.slice(0, 50) + '...');
          }
        }}
        onMessageReceived={(message) => {
          // Track message received events
          if (typeof window !== 'undefined') {
            import('@/lib/analytics').then(({ AnalyticsService }) => {
              AnalyticsService.trackEvent('message_received', {
                messageLength: message.content.length,
                responseTime: Date.now() - message.timestamp.getTime(),
                timestamp: message.timestamp.getTime()
              });
            });
          }
          
          // Optional: Add more detailed logging
          if (process.env.NODE_ENV === 'development') {
            console.log('Message received:', message.content.slice(0, 50) + '...');
          }
        }}
      />
    </div>
  );
}
