"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUser } from '@clerk/nextjs';
import AIProviderSelector from "./ai-provider-selector";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX, Save, Menu, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import ConversationHistory from "./conversation-history";
import AuthControls from "./auth-controls";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSpeech } from "@/hooks/use-speech";
import { IMessage } from "@/lib/types/conversation";
import { UnifiedConversationService, UnifiedConversation } from "@/lib/services/unified-conversation-service";

// Configuration interface for the chat component
interface ChatConfig {
  enableStorage?: boolean;
  enableSpeech?: boolean;
  enableHistory?: boolean;
  autoSave?: boolean;
  defaultProvider?: string;
  maxMessages?: number;
  showProviderBadge?: boolean;
}

// Error types for better error handling
type ChatError = {
  type: 'api' | 'network' | 'auth' | 'validation' | 'speech' | 'storage';
  message: string;
  recoverable: boolean;
  action?: string;
};

interface UnifiedChatInterfaceProps {
  config?: ChatConfig;
  onError?: (error: ChatError) => void;
  onMessageSent?: (message: IMessage) => void;
  onMessageReceived?: (message: IMessage) => void;
  className?: string;
}

const DEFAULT_CONFIG: ChatConfig = {
  enableStorage: true,
  enableSpeech: true,
  enableHistory: true,
  autoSave: true,
  defaultProvider: "chat-groq",
  maxMessages: 100,
  showProviderBadge: true,
};

export default function UnifiedChatInterface({
  config = DEFAULT_CONFIG,
  onError,
  onMessageSent,
  onMessageReceived,
  className = ""
}: UnifiedChatInterfaceProps) {
  const { isSignedIn } = useUser();
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  // State management
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [aiProvider, setAiProvider] = useState(finalConfig.defaultProvider!);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showHistory, setShowHistory] = useState(finalConfig.enableHistory!);
  const [currentConversation, setCurrentConversation] = useState<UnifiedConversation | null>(null);
  const [chatError, setChatError] = useState<ChatError | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Speech functionality (conditionally initialized)
  const speech = useSpeech();
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
  } = finalConfig.enableSpeech ? speech : {
    isListening: false,
    isSpeaking: false,
    isSupported: false,
    hasPermission: false,
    startListening: () => { },
    stopListening: () => { },
    speak: () => { },
    stopSpeaking: () => { },
    requestPermission: () => Promise.resolve(),
    transcript: '',
    error: null,
  };

  // Error handling utility
  const handleError = useCallback((error: ChatError) => {
    // Defensive: ensure error is always a valid object
    const safeError: ChatError = error && typeof error === 'object' && 'type' in error && 'message' in error
      ? error as ChatError
      : {
        type: 'api', // fallback to a valid ChatError type
        message: typeof error === 'string' ? error : 'Unknown error',
        recoverable: true
      };
    setChatError(safeError);
    if (typeof window !== 'undefined') {
      // Log full error for debugging
      // @ts-ignore
      window.__lastChatError = safeError;
    }
    onError?.(safeError);
    // Auto-clear non-critical errors after 5 seconds
    if (safeError.recoverable) {
      setTimeout(() => setChatError(null), 5000);
    }
  }, [onError]);

  // Enhanced error creation utility
  const createError = useCallback((
    type: ChatError['type'],
    message: string,
    recoverable: boolean = true,
    action?: string
  ): ChatError => ({
    type,
    message,
    recoverable,
    action
  }), []);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
    const defaultMessages: IMessage[] = [
      {
        id: "1",
        content: "Hello! I'm your AI assistant. How can I help you today?" +
          (finalConfig.enableSpeech ? " You can click the microphone to speak with me!" : ""),
        role: "assistant",
        timestamp: new Date(),
      },
    ];
    setMessages(defaultMessages);
  }, [finalConfig.enableSpeech]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-save functionality
  useEffect(() => {
    // Only auto-save if signed in
    if (!finalConfig.enableStorage || !finalConfig.autoSave || !isSignedIn || messages.length <= 1) {
      return;
    }

    setSaveStatus('saving');
    const timeoutId = setTimeout(async () => {
      try {
        await UnifiedConversationService.saveMessages(
          currentConversation?.id || null,
          messages,
          true, // always true since isSignedIn is checked above
          aiProvider
        );
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        setSaveStatus('error');
        handleError(createError('storage', 'Failed to auto-save conversation', true));
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      setSaveStatus('idle');
    };
  }, [messages, currentConversation, finalConfig.autoSave, finalConfig.enableStorage, isSignedIn, aiProvider, handleError, createError]);

  // Speech error handling
  useEffect(() => {
    if (speechError && finalConfig.enableSpeech) {
      // Log the error in detail for debugging
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.__lastSpeechError = speechError;
        // Optionally log browser info
        // @ts-ignore
        window.__speechEnv = {
          userAgent: navigator.userAgent,
          protocol: window.location.protocol,
          online: navigator.onLine
        };
      }
      handleError(createError('speech', `Speech error: ${speechError}`, true));
    }
  }, [speechError, finalConfig.enableSpeech, handleError, createError]);

  // Handle speech transcript
  useEffect(() => {
    if (transcript && !isListening && finalConfig.enableSpeech) {
      setInput(transcript);
      // Do not auto-submit. Let user review/edit transcript in input field.
    }
  }, [transcript, isListening, finalConfig.enableSpeech]);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    if (!finalConfig.enableStorage) return;

    try {
      const conversation = await UnifiedConversationService.getConversation(
        conversationId,
        !!isSignedIn
      );
      if (conversation) {
        setCurrentConversation(conversation);
        setMessages(conversation.messages);
        setAiProvider(conversation.aiProvider || finalConfig.defaultProvider!);
      }
    } catch (error) {
      handleError(createError('storage', 'Failed to load conversation', true));
    }
  }, [isSignedIn, finalConfig.enableStorage, finalConfig.defaultProvider, handleError, createError]);

  const handleNewConversation = useCallback(() => {
    setCurrentConversation(null);
    const defaultMessages: IMessage[] = [
      {
        id: "1",
        content: "Hello! I'm your AI assistant. How can I help you today?",
        role: "assistant",
        timestamp: new Date(),
      },
    ];
    setMessages(defaultMessages);
    setChatError(null);
  }, []);

  const handleSaveConversation = useCallback(async () => {
    if (!finalConfig.enableStorage || messages.length <= 1) return;

    setSaveStatus('saving');
    try {
      const savedConversation = await UnifiedConversationService.saveMessages(
        currentConversation?.id || null,
        messages,
        !!isSignedIn,
        aiProvider
      );

      if (savedConversation) {
        setCurrentConversation(savedConversation);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (error) {
      setSaveStatus('error');
      handleError(createError('storage', 'Failed to save conversation', true));
    }
  }, [messages, currentConversation, isSignedIn, aiProvider, finalConfig.enableStorage, handleError, createError]);

  const submitMessage = useCallback(
    async (messageText: string = input.trim()) => {
      if (!messageText || isLoading) return;

      // Validate message length
      if (messageText.length > 4000) {
        handleError(createError('validation', 'Message too long. Please keep it under 4000 characters.', true));
        return;
      }

      // Check message limit
      if (finalConfig.maxMessages && messages.length >= finalConfig.maxMessages * 2) {
        handleError(createError('validation', `Message limit reached (${finalConfig.maxMessages} exchanges). Please start a new conversation.`, true));
        return;
      }

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
      setChatError(null);
      onMessageSent?.(userMessage);

      // Create assistant message placeholder
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
          const errorText = await response.text();
          // Detect if the response is HTML (e.g., Next.js 404 page)
          if (response.status === 404 || /<html/i.test(errorText)) {
            throw new Error(`API endpoint not found for provider '${aiProvider}'. Please check your configuration.`);
          }
          throw new Error(`API request failed: ${response.status} ${errorText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream available");
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
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }

                  if (data.done) break;
                }
              } catch (parseError) {
                console.error("Failed to parse SSE data:", line, parseError);
              }
            }
          }
        }

        const finalAssistantMessage = { ...assistantMessage, content: accumulatedContent };
        onMessageReceived?.(finalAssistantMessage);

        // Auto-speak response
        if (autoSpeak && accumulatedContent && finalConfig.enableSpeech) {
          speak(accumulatedContent);
        }

        // Auto-save conversation
        if (finalConfig.autoSave && finalConfig.enableStorage && (newMessages.length > 1 || accumulatedContent.length > 0)) {
          try {
            const finalMessages = [...newMessages, finalAssistantMessage];
            const savedConversation = await UnifiedConversationService.saveMessages(
              currentConversation?.id || null,
              finalMessages,
              !!isSignedIn,
              aiProvider
            );
            if (savedConversation) {
              setCurrentConversation(savedConversation);
            }
          } catch (saveError) {
            // Don't fail the whole operation for save errors
            handleError(createError('storage', 'Message sent but failed to save', true));
          }
        }

      } catch (error) {
        console.error("Chat error:", error);

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        let chatErrorType: ChatError['type'] = 'api';
        let errorText = "Sorry, I encountered an error. Please try again.";
        let recoverable = true;

        // Detect network errors (fetch throws TypeError on network failure)
        if (error instanceof TypeError && errorMessage.match(/network|fetch|failed|connection/i)) {
          chatErrorType = 'network';
          errorText = "Network error. Please check your connection and try again.";
        } else if (errorMessage.includes('API key')) {
          chatErrorType = 'auth';
          errorText = "API authentication failed. Please check your API key configuration.";
          recoverable = false;
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          chatErrorType = 'api';
          errorText = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (errorMessage.startsWith('API request failed:')) {
          chatErrorType = 'api';
          // Show backend error message if available
          const backendMsg = errorMessage.replace('API request failed:', '').trim();
          // Try to extract JSON error if present
          try {
            const json = JSON.parse(backendMsg);
            if (json && json.error) {
              errorText = json.error;
            } else {
              errorText = backendMsg || errorText;
            }
          } catch {
            errorText = backendMsg || errorText;
          }
        } else if (errorMessage.includes('No response stream available')) {
          chatErrorType = 'api';
          errorText = "No response stream from server. Please try again later.";
        } else if (errorMessage && errorMessage !== 'Unknown error occurred') {
          // Show any other error message from backend
          errorText = errorMessage;
        }

        handleError(createError(chatErrorType, errorText, recoverable, recoverable ? 'retry' : undefined));

        // Update assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: errorText }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      aiProvider,
      autoSpeak,
      speak,
      messages,
      currentConversation,
      finalConfig,
      isSignedIn,
      onMessageSent,
      onMessageReceived,
      handleError,
      createError
    ]
  );

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  }, [submitMessage]);

  const toggleListening = useCallback(async () => {
    if (!finalConfig.enableSpeech || !speechSupported) {
      handleError(createError('speech', 'Speech recognition is not supported in your browser.', false));
      return;
    }

    if (!hasPermission) {
      try {
        await requestPermission();
      } catch (error) {
        handleError(createError('speech', 'Microphone permission denied.', true));
      }
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [
    finalConfig.enableSpeech,
    speechSupported,
    hasPermission,
    isListening,
    requestPermission,
    startListening,
    stopListening,
    handleError,
    createError
  ]);

  const toggleSpeaking = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setAutoSpeak(!autoSpeak);
  }, [isSpeaking, autoSpeak, stopSpeaking]);

  const retryLastMessage = useCallback(() => {
    if (messages.length >= 2) {
      const lastUserMessage = messages[messages.length - 2];
      if (lastUserMessage.role === 'user') {
        // Remove the last assistant message and retry
        setMessages(prev => prev.slice(0, -1));
        submitMessage(lastUserMessage.content);
      }
    }
  }, [messages, submitMessage]);

  // Render error display
  const renderError = () => {
    if (!chatError) return null;

    const IconComponent = chatError.type === 'network' ? RefreshCw : AlertCircle;

    return (
      <div className="mx-auto max-w-4xl mb-4">
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <IconComponent className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{chatError.message}</p>
            </div>
            {chatError.recoverable && chatError.action === 'retry' && (
              <Button onClick={retryLastMessage} size="sm" variant="outline">
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  };

  // Render save status
  const renderSaveStatus = () => {
    if (!finalConfig.enableStorage || saveStatus === 'idle') return null;

    const statusConfig = {
      saving: { icon: RefreshCw, text: 'Saving...', className: 'text-blue-600' },
      saved: { icon: CheckCircle, text: 'Saved', className: 'text-green-600' },
      error: { icon: AlertCircle, text: 'Save failed', className: 'text-red-600' },
    };

    const { icon: Icon, text, className } = statusConfig[saveStatus];

    return (
      <div className={`flex items-center gap-1 text-xs ${className}`}>
        <Icon className="h-3 w-3" />
        {text}
      </div>
    );
  };

  if (!mounted) {
    return <MessageLoadingSkeleton />;
  }

  return (
    <ErrorBoundary onError={(error) => handleError(createError('api', error.message, true))}>
      <div className={`flex flex-col md:flex-row h-screen bg-background ${className}`}>
        {/* Sidebar */}
        {finalConfig.enableHistory && showHistory && (
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-card p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Conversations</h2>
              <Button onClick={handleNewConversation} size="sm" variant="outline">
                New Chat
              </Button>
            </div>

            <ErrorBoundary>
              <ConversationHistory
                onSelectConversation={handleSelectConversation}
                currentConversationId={currentConversation?.id}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center gap-3">
                {finalConfig.enableHistory && (
                  <Button
                    onClick={() => setShowHistory(!showHistory)}
                    variant="ghost"
                    size="sm"
                    title={showHistory ? "Hide sidebar" : "Show sidebar"}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                )}

                <h1 className="text-xl font-semibold">MDS Chatbot</h1>

                <div className="flex items-center gap-2">
                  {finalConfig.showProviderBadge && (
                    <Badge variant="outline" className="text-xs">
                      {aiProvider.replace("chat-", "")}
                    </Badge>
                  )}
                  {currentConversation && !('isGuest' in currentConversation) && (
                    <Badge variant="secondary" className="text-xs">
                      Saved
                    </Badge>
                  )}
                  {!isSignedIn && finalConfig.enableStorage && (
                    <Badge variant="outline" className="text-xs text-orange-600">
                      Guest Mode
                    </Badge>
                  )}
                  {renderSaveStatus()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AuthControls />

                {finalConfig.enableStorage && (
                  <Button
                    onClick={handleSaveConversation}
                    variant="outline"
                    size="sm"
                    disabled={messages.length <= 1 || !isSignedIn}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                )}

                {/* Provider selector moved to input area dropdown */}
              </div>
            </div>
          </div>

          {/* Error display */}
          {renderError()}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <Card
                    className={`max-w-[80%] p-3 ${message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                      }`}
                  >
                    <div className="markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ className, children, ...props }) => (
                            <code
                              className={`${className} bg-background/20 px-1 py-0.5 rounded text-sm`}
                              {...props}
                            >
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-background/20 p-3 rounded-lg overflow-x-auto">
                              {children}
                            </pre>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </div>
              ))}

              {isLoading && <MessageLoadingSkeleton />}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t bg-card p-4">
            <div className="max-w-4xl mx-auto flex gap-2">
              <div className="flex items-center w-full rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-2 py-1 shadow-sm focus-within:ring-2 focus-within:ring-primary gap-1 flex-wrap sm:flex-nowrap">
                {/* Mode button placeholder, replace with your mode logic if needed */}
                <div className="relative">
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    className="appearance-none bg-transparent pl-2 pr-6 py-1 text-xs sm:text-sm text-foreground focus:outline-none rounded-full h-9 min-w-[90px] sm:min-w-[110px]"
                    title="Select provider"
                  >
                    {/* Only show providers with working endpoints */}
                    <option value="chat-groq">Groq (Llama 3.1)</option>
                    <option value="chat-simple">Simple AI</option>
                    <option value="chat-direct">OpenAI</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Menu className="h-4 w-4 opacity-60" />
                  </span>
                </div>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  disabled={isLoading}
                  className="flex-1 border-none bg-transparent focus:ring-0 focus:border-none shadow-none px-2 sm:px-3 min-w-0"
                  style={{ boxShadow: "none" }}
                  autoFocus
                />
                {finalConfig.enableSpeech && !speechSupported && (
                  <div className="text-xs text-red-500 px-2" title="Speech recognition is not supported in your browser or device.">
                    <MicOff className="inline h-4 w-4 mr-1 align-text-bottom" />
                    Speech recognition is not supported in your browser or device.
                  </div>
                )}
                {finalConfig.enableSpeech && speechSupported && (
                  <Button
                    onClick={toggleListening}
                    variant="ghost"
                    size="icon"
                    className={`rounded-full relative transition-all duration-300 ${isListening ? "bg-red-500 hover:bg-red-600 text-white animate-pulse-mic" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                    title={isListening ? "Stop Listening" : "Start Listening"}
                    style={isListening ? { boxShadow: '0 0 0 4px rgba(239,68,68,0.3)' } : {}}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {/* Animated ring for listening */}
                    {isListening && (
                      <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-pulse pointer-events-none" style={{ boxShadow: '0 0 0 6px rgba(239,68,68,0.15)' }} />
                    )}
                  </Button>
                )}
// Add pulse animation for mic button
                // You can move this to your global CSS if preferred
                import "./unified-chat-interface.css";
                {finalConfig.enableSpeech && speechSupported && (
                  <Button
                    onClick={toggleSpeaking}
                    variant="ghost"
                    size="icon"
                    className={`rounded-full ${autoSpeak ? "bg-primary text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                    title={autoSpeak ? "Disable Auto Speak" : "Enable Auto Speak"}
                  >
                    {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  onClick={() => submitMessage()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 ml-1 mt-1 sm:mt-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>


            {finalConfig.enableSpeech && speechError && (
              <div className="text-red-500 text-sm mt-2 max-w-4xl mx-auto flex items-center gap-2">
                <span>Speech error: {speechError}</span>
                {speechError.toLowerCase().includes('permission') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await requestPermission();
                      } catch (e) {
                        handleError(createError('speech', 'Microphone permission denied.', true));
                      }
                    }}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            )}

            {finalConfig.enableSpeech && transcript && isListening && (
              <div className="text-sm text-muted-foreground mt-2 max-w-4xl mx-auto">
                Transcript: {transcript}
              </div>
            )}

            {!isSignedIn && finalConfig.enableStorage && (
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
    </ErrorBoundary>
  );
}
