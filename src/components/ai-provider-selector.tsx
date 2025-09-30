"use client";

import { Badge } from "@/components/ui/badge";

interface AIProviderSelectorProps {
  onProviderChange: (provider: string) => void;
  currentProvider: string;
}

export default function AIProviderSelector({ onProviderChange, currentProvider }: AIProviderSelectorProps) {
  const providers = [
    { 
      id: "chat-rag-groq", 
      name: "Abu Rayyan (Groq)", 
      description: "RAG + Groq AI (Fast & Free)", 
      color: "bg-emerald-500",
      setup: "Document search + Groq Llama 3.1 - completely free!"
    },
    { 
      id: "chat-rag-simple", 
      name: "Abu Rayyan (Free)", 
      description: "RAG without embeddings (Free)", 
      color: "bg-blue-500",
      setup: "Text-based document search - no API credits needed"
    },
    { 
      id: "chat-rag", 
      name: "Abu Rayyan (Premium)", 
      description: "RAG with embeddings (Requires OpenAI)", 
      color: "bg-indigo-500",
      setup: "Vector-based search - requires OpenAI credits"
    },
    { 
      id: "chat-groq", 
      name: "Groq", 
      description: "Fast & Free (Llama 3.1)", 
      color: "bg-green-500",
      setup: "Get free API key at console.groq.com"
    },
    { 
      id: "chat-simple", 
      name: "Simple AI", 
      description: "Basic Test (Always Works)", 
      color: "bg-purple-500",
      setup: "No setup required - for testing"
    },
    { 
      id: "chat-direct", 
      name: "OpenAI", 
      description: "Premium (Requires Credits)", 
      color: "bg-orange-500",
      setup: "Requires OpenAI credits"
    },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {providers.map((provider) => (
        <Badge
          key={provider.id}
          variant={currentProvider === provider.id ? "default" : "outline"}
          className={`cursor-pointer transition-colors ${
            currentProvider === provider.id ? provider.color : "hover:bg-muted"
          }`}
          onClick={() => onProviderChange(provider.id)}
          title={provider.setup}
        >
          <div className="flex items-center gap-1">
            <div 
              className={`w-2 h-2 rounded-full ${
                currentProvider === provider.id ? "bg-white" : provider.color
              }`} 
            />
            {provider.name}
          </div>
        </Badge>
      ))}
    </div>
  );
}
