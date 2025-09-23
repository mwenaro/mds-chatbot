"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX, Save, Menu } from "lucide-react";
import { useUser } from '@clerk/nextjs';
import AIProviderSelector from "./ai-provider-selector";
import ConversationHistory from "./conversation-history";
import AuthControls from "./auth-controls";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSpeech } from "@/hooks/use-speech";
import { IMessage } from "@/lib/types/conversation";
import { UnifiedConversationService, UnifiedConversation } from "@/lib/services/unified-conversation-service";

export default function ChatInterfaceWithStorage() {
  const { isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [aiProvider, setAiProvider] = useState("chat-groq");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [autoSave] = useState(true);
  const [currentConversation, setCurrentConversation] = useState<UnifiedConversation | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Speech functionality
  const {
    isListening,
    isSpeaking,
    isSupported: speechSupported,
    hasPermission,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    requestPermission,
    transcript,
    error: speechError,
  } = useSpeech();

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    // Start with default greeting message
    const defaultMessages: IMessage[] = [
      {
        id: "1",
        content: "Hello! I'm your AI assistant. How can I help you today? You can click the microphone to speak with me!",
        role: "assistant",
        timestamp: new Date(),
      },
    ];
    setMessages(defaultMessages);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-save messages when they change (if auto-save is enabled and we have meaningful content)
  useEffect(() => {
    if (autoSave && messages.length > 1) {
      const timeoutId = setTimeout(async () => {
        await UnifiedConversationService.saveMessages(
          currentConversation?.id || null,
          messages,
          !!isSignedIn,
          aiProvider
        );
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentConversation, autoSave, isSignedIn, aiProvider]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    const conversation = await UnifiedConversationService.getConversation(
      conversationId, 
      !!isSignedIn
    );
    if (conversation) {
      setCurrentConversation(conversation);
      setMessages(conversation.messages);
      setAiProvider(conversation.aiProvider || "chat-groq");
    }
  }, [isSignedIn]);



  const handleSaveConversation = useCallback(async () => {
    if (messages.length <= 1) return; // Don't save if only greeting message

    const savedConversation = await UnifiedConversationService.saveMessages(
      currentConversation?.id || null,
      messages,
      !!isSignedIn,
      aiProvider
    );

    if (savedConversation) {
      setCurrentConversation(savedConversation);
    }
  }, [messages, currentConversation, isSignedIn, aiProvider]);

  const submitMessage = useCallback(
    async (messageText: string = input.trim()) => {
      if (!messageText || isLoading) return;

      const userMessage: IMessage = {
        id: Date.now().toString(),
        content: messageText,
        role: "user",
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);

      // Create an empty assistant message that we'll update as we stream
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: IMessage = {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      try {
        const response = await fetch(`/api/${aiProvider}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage.content,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonString = line.slice(6).trim();
                if (jsonString) {
                  const data = JSON.parse(jsonString);

                  if (data.error) {
                    throw new Error(data.error);
                  }

                  if (data.content) {
                    accumulatedContent += data.content;

                    // Update the message content
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }

                  if (data.done) {
                    break;
                  }
                }
              } catch (parseError) {
                console.error("Failed to parse line:", line, parseError);
              }
            }
          }
        }

        // Auto-speak the response if enabled
        if (autoSpeak && accumulatedContent) {
          speak(accumulatedContent);
        }

        // Auto-save the conversation if we have meaningful content
        if (autoSave && (newMessages.length > 1 || accumulatedContent.length > 0)) {
          const finalMessages = [...newMessages, { ...assistantMessage, content: accumulatedContent }];
          
          const savedConversation = await UnifiedConversationService.saveMessages(
            currentConversation?.id || null,
            finalMessages,
            !!isSignedIn,
            aiProvider
          );

          if (savedConversation) {
            setCurrentConversation(savedConversation);
          }
        }
      } catch (error) {
        console.error("Error:", error);

        // Update the assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: "Sorry, I encountered an error. Please try again.",
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, aiProvider, autoSpeak, speak, messages, currentConversation, autoSave, isSignedIn]
  );

  // Handle speech transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript);
      // Auto-submit if transcript is substantial
      if (transcript.length > 5) {
        setTimeout(() => submitMessage(transcript), 100);
      }
    }
  }, [transcript, isListening, submitMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const toggleListening = async () => {
    if (!speechSupported) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (!hasPermission) {
      await requestPermission();
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      if (isSpeaking) {
        stopSpeaking();
      }
      startListening();
    }
  };

  const toggleSpeaking = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setAutoSpeak(!autoSpeak);
    }
  };

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Conversation History Sidebar */}
      {showHistory && (
        <ConversationHistory
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversation?.id}
        />
      )}

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">
                  {currentConversation?.title || "New Conversation"}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {aiProvider.replace("chat-", "")}
                  </Badge>
                  {currentConversation && !('isGuest' in currentConversation) && (
                    <Badge variant="secondary" className="text-xs">
                      Saved
                    </Badge>
                  )}
                  {!isSignedIn && (
                    <Badge variant="outline" className="text-xs text-orange-600">
                      Guest Mode - Data will be lost on browser close
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AuthControls />
              
              <Button
                onClick={handleSaveConversation}
                variant="outline"
                size="sm"
                disabled={messages.length <= 1 || !isSignedIn}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              
              <AIProviderSelector currentProvider={aiProvider} onProviderChange={setAiProvider} />

              {speechSupported && (
                <div className="flex gap-1">
                  <Button
                    onClick={toggleListening}
                    variant={isListening ? "default" : "outline"}
                    size="sm"
                    className={isListening ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    onClick={toggleSpeaking}
                    variant={autoSpeak ? "default" : "outline"}
                    size="sm"
                  >
                    {autoSpeak ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 bg-primary">
                    <AvatarFallback>
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <Card
                  className={`max-w-[80%] p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </Card>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 bg-secondary">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 bg-primary">
                  <AvatarFallback>
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </AvatarFallback>
                </Avatar>
                <Card className="bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Thinking...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isListening
                    ? "Listening..."
                    : "Type your message or click the microphone to speak..."
                }
                disabled={isLoading}
                className="pr-12"
              />
              {isListening && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-pulse rounded-full h-3 w-3 bg-red-500"></div>
                </div>
              )}
            </div>
            <Button
              onClick={() => submitMessage()}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {speechError && (
            <div className="text-red-500 text-sm mt-2 max-w-4xl mx-auto">
              Speech error: {speechError}
            </div>
          )}

          {transcript && isListening && (
            <div className="text-sm text-muted-foreground mt-2 max-w-4xl mx-auto">
              Transcript: {transcript}
            </div>
          )}

          {!isSignedIn && (
            <div className="text-center mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg max-w-4xl mx-auto">
              <p className="text-sm text-orange-800">
                <strong>Guest Mode:</strong> Your conversation will be lost when you close the browser. 
                <span className="text-orange-600"> Sign up to save your conversations permanently!</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
