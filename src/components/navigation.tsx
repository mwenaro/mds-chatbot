"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, MessageSquare, FileText } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { 
      href: "/", 
      label: "Home", 
      icon: Home,
      description: "Multi-provider chat"
    },
    { 
      href: "/chat", 
      label: "Chat", 
      icon: MessageSquare,
      description: "Standard chat interface"
    },
    { 
      href: "/rag", 
      label: "RAG Test", 
      icon: FileText,
      description: "Abu Rayyan Academy RAG",
      badge: "NEW"
    },
  ];

  return (
    <nav className="border-b bg-white/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">MDS Chatbot</h1>
            <div className="hidden md:flex items-center space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="relative"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                      {item.badge && (
                        <Badge 
                          variant="secondary" 
                          className="ml-2 text-xs bg-blue-100 text-blue-800"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            {navItems.find(item => item.href === pathname)?.description || "AI Chatbot"}
          </div>
        </div>
      </div>
    </nav>
  );
}