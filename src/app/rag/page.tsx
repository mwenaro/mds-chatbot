"use client";

import UnifiedChatInterface from "@/components/unified-chat-interface";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Bot, Search, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function RAGTestPage() {
  const [ragStatus, setRagStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');

  const testRAGEndpoint = async () => {
    try {
      setRagStatus('initializing');
      const response = await fetch('/api/test-rag-simple');
      const data = await response.json();
      
      if (data.success) {
        setRagStatus('ready');
      } else {
        setRagStatus('error');
        console.error('RAG test failed:', data);
      }
    } catch (error) {
      setRagStatus('error');
      console.error('RAG test error:', error);
    }
  };

  useEffect(() => {
    testRAGEndpoint();
  }, []);

  const getStatusBadge = () => {
    switch (ragStatus) {
      case 'initializing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Search className="w-3 h-3 mr-1" />Initializing RAG...</Badge>;
      case 'ready':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />RAG Ready</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />RAG Error</Badge>;
      default:
        return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />RAG System</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <div className="bg-white/50 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🏫 Abu Rayyan Academy RAG Chat
              </h1>
              <p className="text-gray-600">
                Enhanced RAG system with full chat features - speech, history, and document-aware responses
              </p>
            </div>
            {getStatusBadge()}
          </div>
          
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Document Source</p>
                  <p className="text-sm text-gray-600">Abu Rayyan Academy.docx</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium">AI Provider</p>
                  <p className="text-sm text-gray-600">Groq + RAG</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium">Features</p>
                  <p className="text-sm text-gray-600">Speech, History, Auto-save</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="p-4">
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
            console.error("RAG Chat error:", error);
            if (error.type === 'api') {
              setRagStatus('error');
            }
          }}
          onMessageSent={(message) => {
            console.log("RAG message sent:", message.content.slice(0, 50) + '...');
          }}
          onMessageReceived={(message) => {
            console.log("RAG message received:", message.content.slice(0, 50) + '...');
          }}
          className="max-w-6xl mx-auto"
        />
      </div>
    </div>
  );
}