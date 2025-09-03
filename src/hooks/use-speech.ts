"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

// Type declarations for Speech APIs
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  confidence: number;
  transcript: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface UseSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  hasPermission: boolean | null; // null = unknown, true = granted, false = denied
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  requestPermission: () => Promise<boolean>;
  transcript: string;
  error: string | null;
}

export function useSpeech(): UseSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for browser support and initial permission status
  useEffect(() => {
    const speechRecognitionSupported = 
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const speechSynthesisSupported = 'speechSynthesis' in window;
    
    setIsSupported(speechRecognitionSupported && speechSynthesisSupported);
    
    // Check microphone presence and permissions
    const checkMicrophoneStatus = async () => {
      if (!speechRecognitionSupported || !navigator.mediaDevices) {
        return;
      }

      try {
        // Check if we have any audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioInput = devices.some(device => device.kind === 'audioinput');
        
        if (!hasAudioInput) {
          setError('No microphone detected. Please connect a microphone.');
          setHasPermission(false);
          return;
        }

        // Check current permission status
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        if (permissionStatus.state === 'granted') {
          setHasPermission(true);
        } else if (permissionStatus.state === 'denied') {
          setHasPermission(false);
        } else {
          // Permission state is 'prompt' - user hasn't decided yet
          setHasPermission(null);
        }

        // Listen for permission changes
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted') {
            setHasPermission(true);
            setError(null);
          } else if (permissionStatus.state === 'denied') {
            setHasPermission(false);
            setError('Microphone access denied. Click "Try Again" to re-request permission.');
          }
        };

      } catch (error) {
        // Fallback for browsers that don't support permissions API
        console.log('Permissions API not supported, will check on first use');
        setHasPermission(null);
      }
    };

    if (speechRecognitionSupported) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setError(null);
        };
        
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            }
          }
          
          if (finalTranscript) {
            setTranscript(finalTranscript.trim());
          }
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          let errorMessage = `Speech recognition error: ${event.error}`;
          
          // Provide more helpful error messages
          switch (event.error) {
            case 'network':
              errorMessage = 'Speech recognition requires an internet connection. Please check your connection and try again.';
              // Auto-retry after 3 seconds for network errors
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
              retryTimeoutRef.current = setTimeout(() => {
                if (navigator.onLine) {
                  setError(null);
                }
              }, 3000);
              break;
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone permissions and try again.';
              setHasPermission(false);
              break;
            case 'no-speech':
              errorMessage = 'No speech detected. Please speak clearly and try again.';
              break;
            case 'audio-capture':
              errorMessage = 'Microphone not available. Please check your microphone and try again.';
              break;
            case 'service-not-allowed':
              errorMessage = 'Speech recognition service not available. Please try again later.';
              break;
            default:
              errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
          }
          
          setError(errorMessage);
          setIsListening(false);
        };
      }

      // Check microphone status
      checkMicrophoneStatus();
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return false;
    }

    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed to request permission
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      setError(null);
      return true;
      
    } catch (permissionError: any) {
      console.error('Permission request error:', permissionError);
      
      let errorMessage = 'Microphone access denied.';
      
      if (permissionError.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please click "Allow" when prompted by your browser.';
      } else if (permissionError.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (permissionError.name === 'NotSupportedError') {
        errorMessage = 'Microphone not supported by this browser. Try Chrome, Edge, or Safari.';
      }
      
      setHasPermission(false);
      setError(errorMessage);
      return false;
    }
  }, [isSupported]);

  const startListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition is not supported in this browser');
      return;
    }
    
    // Check permission first, request if needed
    if (hasPermission !== true) {
      const granted = await requestPermission();
      if (!granted) {
        return; // Error already set by requestPermission
      }
    }
    
    setTranscript('');
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      let errorMessage = 'Failed to start speech recognition';
      
      if (err.name === 'InvalidStateError') {
        errorMessage = 'Speech recognition is already running. Please wait and try again.';
      } else if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions.';
        setHasPermission(false);
      }
      
      setError(errorMessage);
      console.error('Speech recognition error:', err);
    }
  }, [isSupported, hasPermission, requestPermission]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesisRef.current = utterance;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = (event) => {
      setError(`Speech synthesis error: ${event.error}`);
      setIsSpeaking(false);
    };
    
    // Set voice properties
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && (voice.name.includes('Natural') || voice.name.includes('Premium'))
    ) || voices.find(voice => voice.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    isSupported,
    hasPermission,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    requestPermission,
    transcript,
    error
  };
}
