"use client";
import UnifiedChatInterface from "@/components/unified-chat-interface";

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-background">
      <UnifiedChatInterface
        config={{
          enableStorage: true,
          enableSpeech: true,
          enableHistory: true,
          autoSave: true,
          defaultProvider: "quiz-target", // Custom provider for RAG bot
          maxMessages: 50,
          showProviderBadge: false,
        }}
        onError={(error) => {
          // Optionally handle errors here
          console.error("Chat error:", error);
        }}
        onMessageSent={(message) => {
          // Optionally track sent messages
        }}
        onMessageReceived={(message) => {
          // Optionally track received messages
        }}
      />
    </div>
  );
}
