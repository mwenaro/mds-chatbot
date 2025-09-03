"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import AIProviderSelector from "./ai-provider-selector";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSpeech } from "@/hooks/use-speech";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export default function ChatInterface() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiProvider, setAiProvider] = useState("chat-groq"); // Default to reliable Groq
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false); // Auto-speak AI responses
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Speech functionality
  const {
    isListening,
    isSpeaking,
    isSupported: speechSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    transcript,
    error: speechError
  } = useSpeech();

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    setMessages([
      {
        id: "1",
        content: "Hello! I'm your AI assistant. How can I help you today? You can click the microphone to speak with me!",
        role: "assistant",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Handle speech transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript);
      // Auto-submit if transcript is substantial
      if (transcript.length > 5) {
        submitMessage(transcript);
      }
    }
  }, [transcript, isListening]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const submitMessage = async (messageText: string = input.trim()) => {
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create an empty assistant message that we'll update as we stream
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
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
              // Don't break the loop, just skip this line
            }
          }
        }
      }

      // Auto-speak the response if enabled
      if (autoSpeak && accumulatedContent) {
        speak(accumulatedContent);
      }
    } catch (error) {
      console.error("Error:", error);
      
      // Update the assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: "Sorry, I encountered an error. Please try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage();
  };

  const handleMicClick = async () => {
    if (isListening) {
      stopListening();
    } else {
      // Check if online
      if (!navigator.onLine) {
        alert('Speech recognition requires an internet connection. Please check your connection and try again.');
        return;
      }
      
      if (isSpeaking) {
        stopSpeaking();
      }
      startListening();
    }
  };

  const handleSpeakerToggle = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setAutoSpeak(!autoSpeak);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              <Bot className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">MDS Chatbot</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered assistant
              {mounted && speechSupported && (
                <span className="ml-2 text-green-600">🎤 Voice enabled</span>
              )}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Online
        </Badge>
      </div>

      {/* AI Provider Selector */}
      <div className="px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AI Provider:</span>
          <AIProviderSelector 
            currentProvider={aiProvider} 
            onProviderChange={setAiProvider} 
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
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
                className={`max-w-[80%] p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <div className="markdown-content">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Customize rendering for better chat appearance
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">
                            {children}
                          </code>
                        ) : (
                          <pre className="bg-muted/30 p-3 rounded-md overflow-x-auto mb-2">
                            <code className="text-sm font-mono block">
                              {children}
                            </code>
                          </pre>
                        );
                      },
                      pre: ({ children }) => <div className="mb-2">{children}</div>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic mb-2 text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-foreground">{children}</h3>,
                      a: ({ children, href }) => (
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-2">
                          <table className="min-w-full border border-muted">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted/50">
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th className="border border-muted px-2 py-1 text-left font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-muted px-2 py-1">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {mounted && (
                    <p className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  )}
                  {/* Speak button for assistant messages */}
                  {mounted && speechSupported && message.role === "assistant" && message.content && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speak(message.content)}
                      disabled={isSpeaking}
                      className="ml-2 h-6 px-2 text-xs"
                      title="Speak this message"
                    >
                      <Volume2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <Card className="bg-muted p-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        {/* Speech Status */}
        {mounted && speechSupported && (
          <div className="mb-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {isListening && (
                <Badge variant="destructive" className="animate-pulse">
                  🎤 Listening...
                </Badge>
              )}
              {isSpeaking && (
                <Badge variant="secondary" className="animate-pulse">
                  🔊 Speaking...
                </Badge>
              )}
              {autoSpeak && !isSpeaking && (
                <Badge variant="outline">
                  🔊 Auto-speak enabled
                </Badge>
              )}
            </div>
            {speechError && (
              <div className="text-red-500 text-xs max-w-md text-right">
                ⚠️ {speechError}
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type your message or click the mic..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          {/* Audio Controls */}
          {mounted && (
            <div className="flex gap-1">
              {speechSupported ? (
                <>
                  <Button
                    type="button"
                    variant={isListening ? "destructive" : "outline"}
                    size="icon"
                    onClick={handleMicClick}
                    disabled={isLoading}
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    type="button"
                    variant={autoSpeak ? "default" : "outline"}
                    size="icon"
                    onClick={handleSpeakerToggle}
                    disabled={isLoading}
                    title={isSpeaking ? "Stop speaking" : autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
                  >
                    {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled
                  title="Speech recognition not supported in this browser. Try Chrome, Edge, or Safari."
                >
                  <MicOff className="h-4 w-4 opacity-50" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
