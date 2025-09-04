import React from 'react';
import { Card } from './card';
import { Skeleton } from './skeleton';

interface LoadingSkeletonProps {
  variant?: 'chat' | 'message' | 'list' | 'default';
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ 
  variant = 'default', 
  count = 1, 
  className = '' 
}: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'chat':
        return (
          <div className={`space-y-4 ${className}`}>
            {/* Chat header skeleton */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            
            {/* Messages skeleton */}
            <div className="space-y-4 p-4">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <Card className="max-w-[80%] p-3">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                </div>
              ))}
            </div>
            
            {/* Input skeleton */}
            <div className="flex gap-2 p-4 border-t">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        );
        
      case 'message':
        return (
          <div className={`flex gap-3 ${className}`}>
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <Card className="max-w-[80%] p-3 flex-1">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          </div>
        );
        
      case 'list':
        return (
          <div className={`space-y-2 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        );
        
      default:
        return (
          <div className={`space-y-3 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        );
    }
  };

  return renderSkeleton();
}

// Specific loading components for common use cases
export function ChatLoadingSkeleton() {
  return <LoadingSkeleton variant="chat" count={3} />;
}

export function MessageLoadingSkeleton() {
  return <LoadingSkeleton variant="message" />;
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return <LoadingSkeleton variant="list" count={count} />;
}

export default LoadingSkeleton;
