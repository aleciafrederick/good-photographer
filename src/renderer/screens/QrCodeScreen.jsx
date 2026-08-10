import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import ToolTabs from '../components/ToolTabs';

const QR_PIXEL_SIZE = 1024;
const QR_MARGIN_MODULES = 2;
const QR_ERROR_CORRECTION = 'M';
const MAX_INPUT_LENGTH = 2000;

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function filenameFromInput(input) {
  const trimmed = String(input).trim();
  const date = todayIso();
  let slug;
  try {
    slug = slugify(new URL(trimmed).hostname);
  } catch {
    slug = slugify(trimmed);
  }
  const base = slug ? `qr-${slug}` : 'qr-code';
  return `${base}-${date}.png`;
}

export default function QrCodeScreen({
  activeTab,
  onTabChange,
  text,
  setText,
  qrDataUrl,
  setQrDataUrl,
  error,
  setError,
}) {
  const hasQr = Boolean(qrDataUrl) && !error;
  const [isGenerating, setIsGenerating] = useState(false);
  const canGenerate = !hasQr && !isGenerating && text.trim().length > 0;
  const inputRef = useRef(null);

  useEffect(() => {
    if (!hasQr) {
      inputRef.current?.focus();
    }
  }, [hasQr]);

  const handleGenerate = useCallback(async () => {
    const value = text.trim();
    if (!value) return;
    setIsGenerating(true);
    try {
      const dataUrl = await QRCode.toDataURL(value, {
        width: QR_PIXEL_SIZE,
        margin: QR_MARGIN_MODULES,
        errorCorrectionLevel: QR_ERROR_CORRECTION,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setError(null);
    } catch (err) {
      setQrDataUrl(null);
      setError(
        err && err.message
          ? `Could not generate QR code: ${err.message}`
          : 'Could not generate QR code.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [text, setQrDataUrl, setError]);

  const handleReset = useCallback(() => {
    setText('');
    setQrDataUrl(null);
    setError(null);
  }, [setText, setQrDataUrl, setError]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };

  const encodedText = hasQr ? text.trim() : '';

  return (
    <div className="intake-grid">
      <section className="intake-intro">
        <h1 className="display-heading">
          Generate a QR code for any URL.
        </h1>
        <p className="intro-copy">
          Paste a URL (or any text) and download a high-resolution QR PNG. Everything happens in your browser — no upload, no server round-trip.
        </p>
        <ToolTabs activeTab={activeTab} onChange={onTabChange} />
      </section>

      <section className="intake-form">
        <div className="form-section">
          <div className="form-section-head">
            <h2>Enter a URL or text.</h2>
          </div>
          <p className="form-hint">
            Output is a {QR_PIXEL_SIZE} × {QR_PIXEL_SIZE} PNG with medium error correction.
          </p>
          <div className="qr-input-row">
            <input
              ref={inputRef}
              className="qr-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_INPUT_LENGTH}
              placeholder="https://example.com"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              readOnly={hasQr}
              aria-label="URL or text to encode"
            />
          </div>
        </div>

        <div className="qr-preview-image" aria-live="polite">
          {hasQr ? (
            <img
              src={qrDataUrl}
              alt={encodedText ? `QR code for ${encodedText}` : 'Generated QR code'}
            />
          ) : (
            <p className="qr-preview-placeholder">Your preview will appear here</p>
          )}
        </div>

        {hasQr && (
          <p className="qr-preview-readout">
            <span className="qr-preview-readout-label">Encoded</span>
            <span className="qr-preview-readout-value">{encodedText}</span>
          </p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="qr-actions">
          {hasQr ? (
            <>
              <a
                className="btn btn-primary"
                href={qrDataUrl}
                download={filenameFromInput(text)}
              >
                Download PNG
              </a>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleReset}
              >
                Generate another QR code
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {isGenerating ? 'Generating…' : 'Generate QR Code'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
