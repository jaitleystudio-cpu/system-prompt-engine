import React, { useState } from "react";
import {
  GLOBAL_32_LANGUAGES,
  detectLanguageFromText,
  compileNativeToEnglishProPrompt,
  type GlobalLanguage,
  type TargetFrontierModel,
} from "./multilingualEngine";
import {
  analyzeVideoOrWebLink,
  PRESET_VIDEO_WEBLINKS,
  type VideoLinkAnalysis,
} from "./videoLinkIngest";
import {
  parseAndAnalyzeLyrics,
  PRESET_SONGS,
  type SongAnalysisResult,
} from "./songLyricsEngine";
import { MultimodalBrainStudio } from "./MultimodalBrainStudio";
import { playTactileAudio } from "./AudioStudio";

export interface UnifiedMultilingualBarProps {
  currentText: string;
  onUpdateText: (nextText: string) => void;
  disabled?: boolean;
}

export const UnifiedMultilingualBar: React.FC<UnifiedMultilingualBarProps> = ({
  currentText,
  onUpdateText,
  disabled = false,
}) => {
  const [selectedLang, setSelectedLang] = useState<GlobalLanguage>(() =>
    currentText.trim() ? detectLanguageFromText(currentText) : GLOBAL_32_LANGUAGES[0]
  );
  const [targetModel, setTargetModel] = useState<TargetFrontierModel>("claude-3-7-sonnet");
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [showVideoIngestBox, setShowVideoIngestBox] = useState(false);
  const [showSongsBox, setShowSongsBox] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoAnalysis, setVideoAnalysis] = useState<VideoLinkAnalysis | null>(null);
  const [songLyricsInput, setSongLyricsInput] = useState("");
  const [songAnalysis, setSongAnalysis] = useState<SongAnalysisResult | null>(null);
  const [statusNotice, setStatusNotice] = useState("");

  const detected = currentText.trim() ? detectLanguageFromText(currentText) : selectedLang;

  const handleCompileToEnglishProPrompt = () => {
    playTactileAudio("chime");
    const sourceText = currentText.trim() || selectedLang.sampleIntent;
    const compiled = compileNativeToEnglishProPrompt({
      nativeText: sourceText,
      sourceLanguage: selectedLang,
      targetModel,
    });
    onUpdateText(compiled.proPrompt);
    setStatusNotice(`🚀 Compiled into Frontier English Pro Prompt (${targetModel}) from ${selectedLang.name}!`);
    setTimeout(() => setStatusNotice(""), 4000);
  };

  const handleApplyNativeText = () => {
    playTactileAudio("click");
    if (!currentText.trim()) {
      onUpdateText(selectedLang.sampleIntent);
      setStatusNotice(`🗣️ Loaded ${selectedLang.name} (${selectedLang.nativeName}) sample brief.`);
    } else {
      setStatusNotice(`🗣️ Native script mode active (${selectedLang.name}).`);
    }
    setTimeout(() => setStatusNotice(""), 4000);
  };

  const handleAnalyzeVideoUrl = (url: string) => {
    playTactileAudio("chime");
    const analysis = analyzeVideoOrWebLink(url);
    setVideoAnalysis(analysis);
    const textToInsert = [
      currentText.trim(),
      analysis.compiledProPrompt,
    ].filter(Boolean).join("\n\n");
    onUpdateText(textToInsert);
    setStatusNotice(`🎬 Extracted video transcript & compiled pro prompt from [${analysis.title}]!`);
    setTimeout(() => setStatusNotice(""), 4500);
  };

  const handleAnalyzeSongLyrics = (lyricsText: string) => {
    playTactileAudio("chime");
    const analysis = parseAndAnalyzeLyrics(lyricsText);
    setSongAnalysis(analysis);
    const textToInsert = [
      currentText.trim(),
      analysis.sunoUdioPrompt,
    ].filter(Boolean).join("\n\n");
    onUpdateText(textToInsert);
    setStatusNotice(`🎵 Analyzed song lyrics (${analysis.bpm} BPM, ${analysis.keySignature}) & generated Suno/Udio prompt!`);
    setTimeout(() => setStatusNotice(""), 4500);
  };

  return (
    <div
      style={{
        marginTop: "0.75rem",
        marginBottom: "0.75rem",
        padding: "0.75rem 1rem",
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(30, 41, 59, 0.65))",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        color: "#f8fafc",
      }}
    >
      {/* Top Controls Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
            🌐 Multilingual Engine:
          </span>

          {/* 32 Languages Dropdown */}
          <select
            value={selectedLang.id}
            disabled={disabled}
            onChange={(e) => {
              const lang = GLOBAL_32_LANGUAGES.find((l) => l.id === e.target.value);
              if (lang) {
                setSelectedLang(lang);
                playTactileAudio("click");
              }
            }}
            style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "6px",
              color: "#38bdf8",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              outline: "none",
            }}
          >
            {GLOBAL_32_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.flag} {l.name} ({l.nativeName})
              </option>
            ))}
          </select>

          {/* Target Model Selector */}
          <select
            value={targetModel}
            disabled={disabled}
            onChange={(e) => setTargetModel(e.target.value as TargetFrontierModel)}
            style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              color: "#cbd5e1",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              outline: "none",
            }}
          >
            <option value="claude-3-7-sonnet">Claude 3.7 Sonnet</option>
            <option value="gpt-4o">GPT-4o Frontier</option>
            <option value="gemini-2-flash-thinking">Gemini 2.0 Thinking</option>
            <option value="deepseek-r1">DeepSeek R1</option>
          </select>

          {detected.id !== selectedLang.id && currentText.trim().length > 3 && (
            <span
              style={{
                fontSize: "0.68rem",
                color: "#94a3b8",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              Detected: {detected.flag} {detected.name}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Frontier Pro Prompt Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleCompileToEnglishProPrompt}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 12px",
              borderRadius: "6px",
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #38bdf8)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: disabled ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
            }}
          >
            🚀 English Pro Prompt ({selectedLang.flag}→EN)
          </button>

          {/* Native Script Mode Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleApplyNativeText}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              background: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              fontWeight: 600,
              fontSize: "0.75rem",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            🗣️ Native ({selectedLang.nativeName})
          </button>

          {/* Toggle Video Ingest Box */}
          <button
            type="button"
            onClick={() => {
              playTactileAudio("click");
              setShowVideoIngestBox((prev) => !prev);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: showVideoIngestBox ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
              background: showVideoIngestBox ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
              color: showVideoIngestBox ? "#38bdf8" : "#cbd5e1",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            🎬 Video Links
          </button>

          {/* Toggle Songs & Lyrics */}
          <button
            type="button"
            onClick={() => {
              playTactileAudio("click");
              setShowSongsBox((prev) => !prev);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: showSongsBox ? "1px solid #c084fc" : "1px solid rgba(255, 255, 255, 0.15)",
              background: showSongsBox ? "rgba(192, 132, 252, 0.2)" : "rgba(255, 255, 255, 0.05)",
              color: showSongsBox ? "#c084fc" : "#cbd5e1",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            🎵 Songs to Lyrics
          </button>

          {/* Full Multimodal Brain Studio Modal Launch Button */}
          <button
            type="button"
            onClick={() => {
              playTactileAudio("click");
              setIsBrainModalOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(192, 132, 252, 0.4)",
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2))",
              color: "#e2e8f0",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            🧠 Omni-Brain Studio ↗
          </button>
        </div>
      </div>

      {/* Video / Web Link Ingest Sub-Bar */}
      {showVideoIngestBox && (
        <div
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="Paste YouTube, TikTok, Vimeo, or Web link (e.g. https://www.youtube.com/watch?v=kCc8FmEb1nY)..."
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#fff",
                padding: "0.4rem 0.6rem",
                fontSize: "0.75rem",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => handleAnalyzeVideoUrl(videoUrlInput || PRESET_VIDEO_WEBLINKS[0].url)}
              style={{
                padding: "0.4rem 0.8rem",
                background: "linear-gradient(135deg, #38bdf8, #6366f1)",
                border: "none",
                borderRadius: "6px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Analyze Video & Extract Pro Prompt
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Presets:</span>
            {PRESET_VIDEO_WEBLINKS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setVideoUrlInput(preset.url);
                  handleAnalyzeVideoUrl(preset.url);
                }}
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.03)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                🎬 {preset.title}
              </button>
            ))}
          </div>

          {videoAnalysis && (
            <div style={{ fontSize: "0.7rem", color: "#38bdf8" }}>
              ✓ Extracted {videoAnalysis.chapters.length} timestamped chapters from {videoAnalysis.title} ({videoAnalysis.durationFormatted})
            </div>
          )}
        </div>
      )}

      {/* Songs & Lyrics Sub-Bar */}
      {showSongsBox && (
        <div
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(192, 132, 252, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Preset Songs:</span>
            {PRESET_SONGS.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => {
                  setSongLyricsInput(song.lyrics);
                  handleAnalyzeSongLyrics(song.lyrics);
                }}
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(192, 132, 252, 0.3)",
                  background: "rgba(192, 132, 252, 0.1)",
                  color: "#c084fc",
                  cursor: "pointer",
                }}
              >
                🎵 {song.title} ({song.genre})
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={songLyricsInput}
            onChange={(e) => setSongLyricsInput(e.target.value)}
            placeholder="Paste song lyrics with [Verse], [Chorus] tags to extract musical metrics & Suno/Udio prompts..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              color: "#fff",
              padding: "0.4rem 0.6rem",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />

          <button
            type="button"
            disabled={!songLyricsInput.trim()}
            onClick={() => handleAnalyzeSongLyrics(songLyricsInput)}
            style={{
              alignSelf: "flex-start",
              padding: "0.35rem 0.75rem",
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: !songLyricsInput.trim() ? "not-allowed" : "pointer",
            }}
          >
            Analyze Lyrics & Generate Suno/Udio/Sora Prompts
          </button>

          {songAnalysis && (
            <div style={{ fontSize: "0.7rem", color: "#a855f7" }}>
              ✓ Tempo: {songAnalysis.bpm} BPM | Key: {songAnalysis.keySignature} | Rhymes: {songAnalysis.rhymeSchemeSummary}
            </div>
          )}
        </div>
      )}

      {/* Status Notice */}
      {statusNotice && (
        <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600 }}>
          {statusNotice}
        </div>
      )}

      {/* Multimodal Brain Studio Modal */}
      {isBrainModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(14px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBrainModalOpen(false);
          }}
        >
          <MultimodalBrainStudio
            initialTranscript={currentText}
            onApplyPrompt={(prompt) => {
              onUpdateText(prompt);
              setIsBrainModalOpen(false);
            }}
            onClose={() => setIsBrainModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
