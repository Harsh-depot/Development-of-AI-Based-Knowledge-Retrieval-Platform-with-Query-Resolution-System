/**
 * Browser-native Web Speech API Integration ($0.00 Cost Stack)
 * - window.SpeechRecognition / window.webkitSpeechRecognition for live voice input
 * - window.speechSynthesis for regex-sanitized natural speech output
 */

export class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isListening = false;
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  isRecognitionSupported() {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  isSynthesisSupported() {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }

  /**
   * Prompts the browser for microphone permission via getUserMedia
   * to ensure permissions are granted before starting recognition.
   */
  async requestMicrophonePermission() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop audio tracks after verifying permission
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.warn("Microphone permission check failed:", err);
        return false;
      }
    }
    return true;
  }

  async startListening({ onInterim, onFinal, onError, onEnd }) {
    if (!this.isRecognitionSupported()) {
      if (onError) onError("Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    // Stop ongoing recognition if any
    this.stopListening();

    // Verify microphone permission
    const hasPermission = await this.requestMicrophonePermission();
    if (!hasPermission) {
      if (onError) onError("Microphone access was denied. Please click the tune/lock icon in your browser address bar and enable 'Microphone'.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = navigator.language || 'en-US';
      this.recognition.maxAlternatives = 1;
    } catch (e) {
      if (onError) onError(`Failed to initialize speech recognition: ${e.message}`);
      return;
    }

    let finalTranscript = '';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript.trim();
        } else {
          interimTranscript += transcript;
        }
      }

      const activeText = finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '');

      if (onInterim && activeText) {
        onInterim(activeText.trim());
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      let userFriendlyMessage = "Speech recognition error.";

      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          userFriendlyMessage = "Microphone access blocked. Click the lock icon in the address bar to allow microphone access.";
          break;
        case 'no-speech':
          userFriendlyMessage = "No speech detected. Please speak closer to the microphone.";
          break;
        case 'audio-capture':
          userFriendlyMessage = "No microphone hardware found. Please plug in or enable your microphone.";
          break;
        case 'network':
          userFriendlyMessage = "Speech service network error. Check your internet connection.";
          break;
        case 'aborted':
          // Intentionally stopped
          return;
        default:
          userFriendlyMessage = `Speech error: ${event.error || 'Unknown error'}`;
      }

      if (onError) onError(userFriendlyMessage);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onFinal && finalTranscript.trim()) {
        onFinal(finalTranscript.trim());
      }
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.warn("SpeechRecognition start exception:", e);
      this.isListening = false;
      if (onError) onError(`Could not start speech recognition: ${e.message}`);
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore already stopped
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  /**
   * Sanitizes markdown text for speech synthesis:
   * Strips markdown bold, italics, bullet points, source citations [DocName, p.1, Chunk#2],
   * URLs, and extra symbols so spoken speech is natural and fluent.
   */
  sanitizeTextForSpeech(text) {
    if (!text) return '';

    return text
      // Remove bracketed citations like [hr_policy.txt, p.1, Chunk#1] or [Source: ...]
      .replace(/\[(?:Source:|[a-zA-Z0-9_\-\.]+\s*,\s*p\.\d+)[^\]]*\]/gi, '')
      // Remove other bracketed references
      .replace(/\[\d+\]/g, '')
      // Remove markdown bold and italics: **text** or *text* or _text_
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove markdown headers: # Header
      .replace(/^#+\s+/gm, '')
      // Remove bullets and numbered lists: * item, - item, 1. item
      .replace(/^[\*\-•]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Remove code blocks and backticks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Clean up multiple spaces and newlines
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  speak(text, { onStart, onEnd, onError } = {}) {
    if (!this.synth) {
      if (onError) onError(new Error("Speech synthesis not supported."));
      return;
    }

    // Stop ongoing speech
    this.stopSpeaking();

    const cleanText = this.sanitizeTextForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a natural English voice if available
    const voices = this.synth.getVoices();
    const naturalVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Aria')) && v.lang.startsWith('en'));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onError) onError(e);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }
}

export const speechEngine = new SpeechEngine();
