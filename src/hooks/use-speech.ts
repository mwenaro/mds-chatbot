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
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

interface UseSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  hasPermission: boolean | null; // null = unknown, true = granted, false = denied
  startListening: (onAutoSubmit?: (transcript: string) => void) => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  requestPermission: () => Promise<boolean>;
  testSpeechService: () => Promise<boolean>;
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
  const autoSubmitCallbackRef = useRef<((transcript: string) => void) | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');

  // Check for browser support and initial permission status
  // Play a short sound for listening start/stop
  const playMicSound = (type: 'start' | 'stop') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = type === 'start' ? 880 : 440;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.15);
      o.onended = () => ctx.close();
    } catch {}
  };

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      // Clear network-related errors when connection is restored
      if (error && error.includes('internet connection')) {
        setError(null);
      }
    };

    const handleOffline = () => {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setError('Speech recognition requires an internet connection. Please check your connection and try again.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error, isListening]);

  useEffect(() => {
    const speechRecognitionSupported = 
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const speechSynthesisSupported = 'speechSynthesis' in window;
    
    // Check if running on HTTPS (required for production)
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
    if (speechRecognitionSupported && !isSecureContext) {
      setError('Speech recognition requires HTTPS. This feature only works on secure connections.');
      setIsSupported(false);
      return;
    }
    
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

      } catch {
        // Fallback for browsers that don't support permissions API
        console.log('Permissions API not supported, will check on first use');
        setHasPermission(null);
      }
    };

    if (speechRecognitionSupported) {
      const windowWithSpeechRecognition = window as typeof window & {
        SpeechRecognition?: new() => SpeechRecognition;
        webkitSpeechRecognition?: new() => SpeechRecognition;
      };
      const SpeechRecognitionClass = windowWithSpeechRecognition.SpeechRecognition || windowWithSpeechRecognition.webkitSpeechRecognition;
      
      if (SpeechRecognitionClass) {
        recognitionRef.current = new SpeechRecognitionClass();
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true; // Enable continuous listening
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setError(null);
          finalTranscriptRef.current = '';
          playMicSound('start');
        };

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interimTranscript += result[0].transcript;
            }
          }
          
          // Update final transcript accumulator
          if (finalTranscript) {
            finalTranscriptRef.current += finalTranscript;
          }
          
          // Show current transcript (interim + final)
          const currentTranscript = (finalTranscriptRef.current + interimTranscript).trim();
          setTranscript(currentTranscript);
          
          // Reset silence timeout on any speech activity
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
          
          // Set up auto-submit on silence (2 seconds of no speech)
          if (autoSubmitCallbackRef.current && (finalTranscript || finalTranscriptRef.current)) {
            silenceTimeoutRef.current = setTimeout(() => {
              const fullTranscript = finalTranscriptRef.current.trim();
              if (fullTranscript && autoSubmitCallbackRef.current) {
                // Stop listening and submit
                if (recognitionRef.current) {
                  recognitionRef.current.stop();
                }
                autoSubmitCallbackRef.current(fullTranscript);
                setTranscript('');
                finalTranscriptRef.current = '';
                autoSubmitCallbackRef.current = null;
              }
            }, 2000); // 2 second silence threshold
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          playMicSound('stop');
          
          // Clear timeouts
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
          
          // If we have a final transcript and auto-submit is enabled, submit it
          const fullTranscript = finalTranscriptRef.current.trim();
          if (fullTranscript && autoSubmitCallbackRef.current) {
            autoSubmitCallbackRef.current(fullTranscript);
            setTranscript('');
            finalTranscriptRef.current = '';
            autoSubmitCallbackRef.current = null;
          }
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          let errorMessage = `Speech recognition error: ${event.error}`;
          // Provide more helpful error messages
          switch (event.error) {
            case 'network':
              // Distinguish between network connectivity and speech service issues
              if (navigator.onLine) {
                errorMessage = 'Speech service temporarily unavailable. This may be due to:\n• Firewall/proxy blocking speech services\n• Google Speech API regional restrictions\n• Corporate network policies\n\nTry using a different network or VPN.';
              } else {
                errorMessage = 'No internet connection detected. Please check your network connection and try again.';
              }
              
              // Auto-retry logic with better conditions
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
              retryTimeoutRef.current = setTimeout(() => {
                // Only clear error if we're actually online and it's been a while
                if (navigator.onLine && !isListening) {
                  setError(null);
                }
              }, 5000);
              break;
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone permissions and try again.';
              setHasPermission(false);
              break;
            case 'no-speech':
              errorMessage = 'No speech detected. Please speak clearly and try again.';
              // Auto-clear this error after a short delay since it's not critical
              setTimeout(() => setError(null), 3000);
              break;
            case 'audio-capture':
              errorMessage = 'Microphone not available. Please check your microphone and try again.';
              break;
              break;
            case 'service-not-allowed':
              errorMessage = 'Speech recognition service not available. Please try again later.';
              break;
            default:
              errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
          }
          setError(errorMessage);
          setIsListening(false);
          playMicSound('stop');
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
      
    } catch (permissionError: unknown) {
      console.error('Permission request error:', permissionError);
      
      let errorMessage = 'Microphone access denied.';
      
      if (permissionError instanceof DOMException) {
        if (permissionError.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please click "Allow" when prompted by your browser.';
        } else if (permissionError.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (permissionError.name === 'NotSupportedError') {
          errorMessage = 'Microphone not supported by this browser. Try Chrome, Edge, or Safari.';
        }
      }
      
      setHasPermission(false);
      setError(errorMessage);
      return false;
    }
  }, [isSupported]);

  // Diagnostic function to test speech service connectivity
  const testSpeechService = useCallback(async (): Promise<boolean> => {
    if (!recognitionRef.current) return false;
    
    return new Promise((resolve) => {
      const testRecognition = recognitionRef.current!;
      let testCompleted = false;
      
      const cleanup = () => {
        if (testCompleted) return;
        testCompleted = true;
        try {
          testRecognition.stop();
        } catch {}
      };

      // Set up test handlers
      const originalOnStart = testRecognition.onstart;
      const originalOnError = testRecognition.onerror;
      const originalOnEnd = testRecognition.onend;

      testRecognition.onstart = () => {
        // Service is accessible if we get to start
        cleanup();
        resolve(true);
        // Restore original handlers
        testRecognition.onstart = originalOnStart;
        testRecognition.onerror = originalOnError;
        testRecognition.onend = originalOnEnd;
      };

      testRecognition.onerror = (event) => {
        cleanup();
        resolve(false);
        // Restore original handlers
        testRecognition.onstart = originalOnStart;
        testRecognition.onerror = originalOnError;
        testRecognition.onend = originalOnEnd;
      };

      // Timeout the test after 5 seconds
      setTimeout(() => {
        cleanup();
        resolve(false);
        // Restore original handlers
        testRecognition.onstart = originalOnStart;
        testRecognition.onerror = originalOnError;
        testRecognition.onend = originalOnEnd;
      }, 5000);

      try {
        testRecognition.start();
      } catch {
        cleanup();
        resolve(false);
        // Restore original handlers
        testRecognition.onstart = originalOnStart;
        testRecognition.onerror = originalOnError;
        testRecognition.onend = originalOnEnd;
      }
    });
  }, []);

  const startListening = useCallback(async (onAutoSubmit?: (transcript: string) => void) => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // Check internet connectivity first
    if (!navigator.onLine) {
      setError('No internet connection detected. Please check your network connection and try again.');
      return;
    }
    
    // Check permission first, request if needed
    if (hasPermission !== true) {
      const granted = await requestPermission();
      if (!granted) {
        return; // Error already set by requestPermission
      }
    }
    
    // Set up auto-submit callback
    autoSubmitCallbackRef.current = onAutoSubmit || null;
    
    setTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
    
    try {
      recognitionRef.current.start();
    } catch (err: unknown) {
      let errorMessage = 'Failed to start speech recognition';
      
      if (err instanceof DOMException) {
        if (err.name === 'InvalidStateError') {
          errorMessage = 'Speech recognition is already running. Please wait and try again.';
        } else if (err.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please allow microphone permissions.';
          setHasPermission(false);
        }
      }
      
      setError(errorMessage);
      console.error('Speech recognition error:', err);
    }
  }, [isSupported, hasPermission, requestPermission]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    
    // Clean up auto-submit state
    autoSubmitCallbackRef.current = null;
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
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
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
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
    testSpeechService,
    transcript,
    error
  };
}