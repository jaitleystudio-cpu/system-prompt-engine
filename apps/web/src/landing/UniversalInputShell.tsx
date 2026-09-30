import React, { useState, useRef } from "react";
import { ModalModeSelector, type ExecutionMode, EXECUTION_MODES } from "./ModalModeSelector";
import "./universal-shell.css";

export type ShellInputType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "url"
  | "screenshot"
  | "document";

export type ShellAction =
  | "prompt"
  | "transcribe"
  | "build"
  | "code"
  | "research"
  | "create";

export interface AttachedMedia {
  id: string;
  name: string;
  type: ShellInputType;
  sizeBytes?: number;
  previewUrl?: string;
}

export interface UniversalInputShellProps {
  initialAction?: ShellAction;
  initialInputType?: ShellInputType;
  placeholder?: string;
  onSubmit?: (payload: {
    action: ShellAction;
    inputType: ShellInputType;
    text: string;
    mode: ExecutionMode;
    attachments: AttachedMedia[];
  }) => void;
  busy?: boolean;
}

const ACTION_DEFINITIONS: Array<{ id: ShellAction; label: string; description: string }> = [
  { id: "prompt", label: "Prompt", description: "Compile structured system prompt" },
  { id: "transcribe", label: "Transcribe", description: "Transcribe audio & video into structured transcript" },
  { id: "build", label: "Build", description: "Generate project architecture & implementation" },
  { id: "code", label: "Code", description: "Synthesize production-ready source code" },
  { id: "research", label: "Research", description: "Conduct empirical investigation & citation search" },
  { id: "create", label: "Create", description: "Produce visual assets & creative media" },
];

const INPUT_TYPE_DEFINITIONS: Array<{ id: ShellInputType; label: string; icon: string }> = [
  { id: "text", label: "Text", icon: "✎" },
  { id: "image", label: "Image", icon: "🖼" },
  { id: "audio", label: "Audio", icon: "🎙" },
  { id: "video", label: "Video", icon: "🎬" },
  { id: "url", label: "URL", icon: "🔗" },
  { id: "screenshot", label: "Screenshot", icon: "📷" },
  { id: "document", label: "Document", icon: "📄" },
];

export const UniversalInputShell: React.FC<UniversalInputShellProps> = ({
  initialAction = "prompt",
  initialInputType = "text",
  placeholder = "Describe your objective, requirements, or attach reference media...",
  onSubmit,
  busy = false,
}) => {
  const [activeAction, setActiveAction] = useState<ShellAction>(initialAction);
  const [activeInputType, setActiveInputType] = useState<ShellInputType>(initialInputType);
  const [activeMode, setActiveMode] = useState<ExecutionMode>("standard");
  const [textValue, setTextValue] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachedMedia[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active mode metadata
  const currentModeOption = EXECUTION_MODES.find((m) => m.id === activeMode) || EXECUTION_MODES[0];

  const handleActionChange = (action: ShellAction) => {
    setActiveAction(action);
  };

  const handleInputTypeChange = (type: ShellInputType) => {
    setActiveInputType(type);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachedMedia[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      name: file.name,
      type: activeInputType,
      sizeBytes: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const newMedia: AttachedMedia = {
            id: `paste-${Date.now()}`,
            name: `Pasted Screenshot ${new Date().toLocaleTimeString()}`,
            type: "screenshot",
            sizeBytes: file.size,
            previewUrl: URL.createObjectURL(file),
          };
          setAttachments((prev) => [...prev, newMedia]);
          setActiveInputType("screenshot");
        }
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const finalContent = activeInputType === "url" && urlValue ? urlValue : textValue;
    if (!finalContent.trim() && attachments.length === 0) return;

    if (onSubmit) {
      onSubmit({
        action: activeAction,
        inputType: activeInputType,
        text: finalContent,
        mode: activeMode,
        attachments,
      });
    }
  };

  return (
    <div className="spe-universal-shell" role="region" aria-label="Universal Input Workspace">
      {/* Action Toolbar Header */}
      <header className="spe-shell-header">
        <nav
          className="spe-shell-actions-nav"
          role="toolbar"
          aria-label="Universal Operations Toolbar"
        >
          {ACTION_DEFINITIONS.map((action) => {
            const isSelected = activeAction === action.id;
            return (
              <button
                key={action.id}
                type="button"
                className={`spe-shell-action-btn ${isSelected ? "active" : ""}`}
                aria-selected={isSelected}
                aria-label={action.label}
                title={action.description}
                onClick={() => handleActionChange(action.id)}
              >
                <span>{action.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Synthesis Mode Selector Trigger */}
        <button
          type="button"
          className="spe-shell-mode-trigger"
          onClick={() => setIsModeModalOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Current mode: ${currentModeOption.name}. Click to change.`}
        >
          <span>Mode:</span>
          <strong>{currentModeOption.name}</strong>
          <span style={{ fontSize: "0.625rem", opacity: 0.7 }}>▼</span>
        </button>
      </header>

      {/* Input Type Selection Tabs */}
      <div
        className="spe-shell-types-bar"
        role="tablist"
        aria-label="Supported Input Formats"
      >
        {INPUT_TYPE_DEFINITIONS.map((t) => {
          const isSelected = activeInputType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={`spe-shell-type-tab ${isSelected ? "active" : ""}`}
              aria-selected={isSelected}
              aria-label={`${t.label} input type`}
              onClick={() => handleInputTypeChange(t.id)}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Input Body */}
      <form onSubmit={handleFormSubmit} className="spe-shell-editor-stage" role="form">
        {/* Dynamic Input Surface depending on activeInputType */}
        {activeInputType === "text" && (
          <textarea
            ref={textareaRef}
            className="spe-shell-textarea"
            placeholder={placeholder}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            aria-label="Prompt and specification input"
          />
        )}

        {activeInputType === "url" && (
          <div className="spe-shell-url-input">
            <input
              type="url"
              className="spe-shell-url-field"
              placeholder="https://example.com/reference-page"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              aria-label="URL Reference input"
              pattern="https?://.+"
              required
            />
          </div>
        )}

        {(activeInputType === "image" ||
          activeInputType === "audio" ||
          activeInputType === "video" ||
          activeInputType === "screenshot" ||
          activeInputType === "document") && (
          <div>
            <div
              className={`spe-shell-dropzone ${isDragging ? "dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const newAttachments: AttachedMedia[] = Array.from(files).map((file, idx) => ({
                    id: `${Date.now()}-${idx}`,
                    name: file.name,
                    type: activeInputType,
                    sizeBytes: file.size,
                    previewUrl: file.type.startsWith("image/")
                      ? URL.createObjectURL(file)
                      : undefined,
                  }));
                  setAttachments((prev) => [...prev, ...newAttachments]);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label={`Attach ${activeInputType} reference file`}
            >
              <div className="spe-shell-dropzone-icon">
                {activeInputType === "image" && "🖼"}
                {activeInputType === "audio" && "🎙"}
                {activeInputType === "video" && "🎬"}
                {activeInputType === "screenshot" && "📷"}
                {activeInputType === "document" && "📄"}
              </div>
              <div className="spe-shell-dropzone-text">
                Click or drag & drop {activeInputType} files here
              </div>
              <div className="spe-shell-dropzone-subtext">
                Supported formats depend on media type. Maximum file size 50MB.
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
              multiple
              aria-label={`Upload ${activeInputType} file`}
            />

            {/* Optional accompanying note */}
            <div style={{ marginTop: "12px" }}>
              <textarea
                className="spe-shell-textarea"
                placeholder={`Add optional contextual guidelines for this ${activeInputType}...`}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                rows={2}
                aria-label={`Context notes for ${activeInputType}`}
              />
            </div>
          </div>
        )}

        {/* Attached Files List */}
        {attachments.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              padding: "4px 0",
            }}
            aria-label="Attached references"
          >
            {attachments.map((file) => (
              <div
                key={file.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  fontSize: "0.8125rem",
                  border: "1px solid var(--spe-shell-border)",
                }}
              >
                <span>📎 {file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((a) => a.id !== file.id))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--spe-shell-muted)",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                  aria-label={`Remove attachment ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer with Mode Summary and Action Trigger */}
        <footer className="spe-shell-footer">
          <div className="spe-shell-status-indicator">
            <span className="spe-shell-status-dot" aria-hidden="true" />
            <span>Ready ({currentModeOption.name})</span>
          </div>

          <button
            type="submit"
            className="spe-shell-primary-btn"
            disabled={
              busy ||
              (!textValue.trim() &&
                !urlValue.trim() &&
                attachments.length === 0)
            }
            aria-label={`Execute ${activeAction}`}
          >
            {busy ? "Processing..." : `Execute ${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)}`}
          </button>
        </footer>
      </form>

      {/* Mode Selector Modal */}
      <ModalModeSelector
        isOpen={isModeModalOpen}
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onClose={() => setIsModeModalOpen(false)}
      />
    </div>
  );
};
