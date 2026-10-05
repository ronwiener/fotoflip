import React, { useState, useEffect, useCallback, useRef } from "react";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { SpeechContext } from "./SpeechContext";

let globalVoiceIndexCache = null;
let isFetchingVoices = false;

export function SpeechProvider({ children }) {
  const [activeText, setActiveText] = useState("");
  const [activeCardId, setActiveCardId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [formattedDuration, setFormattedDuration] = useState("0:00");

  const progressInterval = useRef(null);
  const cachedVoiceIndex = useRef(globalVoiceIndexCache);

  useEffect(() => {
    let isMounted = true;

    async function loadBestVoice() {
      if (globalVoiceIndexCache !== null) {
        cachedVoiceIndex.current = globalVoiceIndexCache;
        return;
      }

      if (isFetchingVoices) return;
      isFetchingVoices = true;

      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        if (!voices || voices.length === 0 || !isMounted) return;

        const englishVoices = voices
          .map((v, index) => ({ ...v, index }))
          .filter(
            (v) =>
              v.lang &&
              (v.lang.toLowerCase() === "en-us" ||
                v.lang.toLowerCase().startsWith("en")),
          );

        if (englishVoices.length === 0) return;

        const scored = englishVoices.map((v) => {
          let score = 0;
          const name = (v.name || "").toLowerCase();
          const uri = (v.voiceURI || "").toLowerCase();

          if (name.includes("ava")) score += 500;
          if (name.includes("premium") || uri.includes("premium")) score += 100;
          if (name.includes("enhanced") || uri.includes("enhanced"))
            score += 80;
          if (name.includes("siri") || uri.includes("siri")) score += 60;
          if (name.includes("samantha") || uri.includes("samantha"))
            score += 40;
          if (name.includes("compact") || uri.includes("compact")) score -= 50;
          if (v.lang.toLowerCase() === "en-us") score += 10;

          return { index: v.index, score, name: v.name };
        });

        scored.sort((a, b) => b.score - a.score);

        if (scored[0] && isMounted) {
          globalVoiceIndexCache = scored[0].index;
          cachedVoiceIndex.current = scored[0].index;
        }
      } catch (e) {
        console.warn("Could not load high-quality TTS voices:", e);
      } finally {
        isFetchingVoices = false;
      }
    }

    loadBestVoice();

    return () => {
      isMounted = false;
    };
  }, []);

  const stopProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    setSpeechProgress(0);
  };

  const cancelSpeech = useCallback(async () => {
    try {
      await TextToSpeech.stop();
    } catch (e) {
      // Ignore if not speaking
    } finally {
      setIsSpeaking(false);
      setActiveCardId(null);
      setActiveText("");
      stopProgressTracking();
    }
  }, []);

  const getFormattedDuration = (text) => {
    if (!text || !text.trim()) return "0:00";
    const words = text.trim().split(/\s+/).length;
    const totalSeconds = Math.max(1, Math.ceil((words / 150) * 60));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const toggleSpeak = useCallback(
    async (textToSpeak, cardId = null) => {
      if (
        isSpeaking &&
        (cardId === activeCardId || textToSpeak === activeText)
      ) {
        await cancelSpeech();
        return;
      }

      const cleanText = textToSpeak?.trim();
      if (!cleanText) return;

      await cancelSpeech();

      setIsSpeaking(true);
      setActiveText(cleanText);
      setActiveCardId(cardId);
      setSpeechProgress(0);
      setFormattedDuration(getFormattedDuration(cleanText));

      const words = cleanText.split(/\s+/).length;
      const estimatedMs = Math.max(1000, (words / 150) * 60 * 1000);
      const intervalMs = 100;
      let elapsed = 0;

      progressInterval.current = setInterval(() => {
        elapsed += intervalMs;
        const progress = Math.min(100, (elapsed / estimatedMs) * 100);
        setSpeechProgress(progress);
      }, intervalMs);

      try {
        const selectedIndex = cachedVoiceIndex.current ?? globalVoiceIndexCache;

        await TextToSpeech.speak({
          text: cleanText,
          lang: "en-US",
          voice: typeof selectedIndex === "number" ? selectedIndex : undefined,
          rate: 0.95,
          pitch: 1.0,
          volume: 1.0,
          category: "ambient",
        });
      } catch (error) {
        console.error("Speech playback error:", error);
      } finally {
        setIsSpeaking(false);
        setActiveCardId(null);
        stopProgressTracking();
      }
    },
    [isSpeaking, activeCardId, activeText, cancelSpeech],
  );

  const toggleDictation = useCallback(
    async (onTranscript, cardId = null) => {
      if (isListening) {
        try {
          await SpeechRecognition.stop();
          await SpeechRecognition.removeAllListeners();
        } catch (e) {
          console.error("Error stopping dictation:", e);
        } finally {
          setIsListening(false);
          setActiveCardId(null);
        }
        return;
      }

      try {
        // 1. Verify / request permissions with standard Capacitor API signature
        const status = await SpeechRecognition.checkPermissions();

        if (status.speechRecognition !== "granted") {
          const reqStatus = await SpeechRecognition.requestPermissions();
          if (reqStatus.speechRecognition !== "granted") {
            console.warn("Speech recognition permission denied by user");
            return;
          }
        }

        // 2. Remove previous listeners
        await SpeechRecognition.removeAllListeners();

        // 3. Attach partial results listener
        await SpeechRecognition.addListener("partialResults", (data) => {
          if (
            data.matches &&
            data.matches.length > 0 &&
            typeof onTranscript === "function"
          ) {
            onTranscript(data.matches[0]);
          }
        });

        setIsListening(true);
        setActiveCardId(cardId);

        // 4. Start native plugin speech recognition
        await SpeechRecognition.start({
          language: "en-US",
          maxResults: 1,
          prompt: "Say your notes...",
          partialResults: true,
          popup: false,
        });
      } catch (error) {
        console.error("Dictation error:", error);
        await SpeechRecognition.removeAllListeners();
        setIsListening(false);
        setActiveCardId(null);
      }
    },
    [isListening],
  );

  return (
    <SpeechContext.Provider
      value={{
        isSpeaking,
        isListening,
        activeCardId,
        speechProgress,
        formattedDuration,
        getFormattedDuration,
        toggleSpeak,
        cancelSpeech,
        toggleDictation,
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
}
