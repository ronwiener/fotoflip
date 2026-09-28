import { useContext } from "react";
import { SpeechContext } from "./SpeechContext";

export const useSpeech = () => useContext(SpeechContext);
