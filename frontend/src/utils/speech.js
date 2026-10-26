/**
 * Browser-native Web Speech API Integration ($0.00 Cost Stack)
 * - window.SpeechRecognition / window.webkitSpeechRecognition for live voice input
 * - window.speechSynthesis for regex-sanitized natural speech output
 */

export class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.synth = window.speechSynthesis || null;
    this.isListening = false;
    this.isSpeaking = false;
    this.currentUtterance = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  isRecognitionSupported() {
    return !!this.recognition;
  }

  isSynthesisSupported() {
    return !!this.synth;
  }

  startListening({ onInterim, onFinal, onError, onEnd }) {
    if (!this.recognition) {
      if (onError) onError(new Error("Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge."));
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (onInterim && interimTranscript) {
        onInterim(interimTranscript);
      }

      if (onFinal && finalTranscript) {
        onFinal(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      if (onError) onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.warn("SpeechRecognition already started or error:", e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
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

  pauseSpeaking() {
    if (this.synth && this.isSpeaking) {
      this.synth.pause();
    }
  }

  resumeSpeaking() {
    if (this.synth) {
      this.synth.resume();
    }
  }
}

export const speechEngine = new SpeechEngine();
