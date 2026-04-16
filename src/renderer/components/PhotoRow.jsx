import { useEffect, useState } from 'react';
import {
  createTinyPreview,
  enqueuePreviewJob,
  getCachedPreview,
  schedulePreviewLoad,
  storeCachedPreview,
} from './photoPreview';

function stripSpaces(value) {
  return String(value).replace(/\s+/g, '');
}

export default function PhotoRow({ photo, onChange, onRemove, valid }) {
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    const cachedPreview = getCachedPreview(photo);
    if (cachedPreview) {
      setPreviewSrc(cachedPreview.dataUrl);
      return undefined;
    }

    setPreviewSrc(null);
    let cancelled = false;

    const cancelScheduledLoad = schedulePreviewLoad(() => {
      if (cancelled) return;

      enqueuePreviewJob(() => createTinyPreview(photo))
        .then((preview) => {
          if (cancelled || !preview) return;
          storeCachedPreview(photo, preview);
          setPreviewSrc(preview.dataUrl);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, [photo.file, photo.path]);

  return (
    <div className={`photo-row ${valid ? '' : 'invalid'}`}>
      <div className="field field-first">
        <label>First Name*</label>
        <input
          value={photo.firstName}
          onChange={(e) => onChange({ firstName: stripSpaces(e.target.value) })}
          placeholder="First name"
        />
      </div>
      <div className="field field-last">
        <label>Last Name*</label>
        <input
          value={photo.lastName}
          onChange={(e) => onChange({ lastName: stripSpaces(e.target.value) })}
          placeholder="Last name"
        />
      </div>
      <div className="field field-year">
        <label>Year*</label>
        <input
          value={photo.year}
          onChange={(e) => onChange({ year: stripSpaces(e.target.value) })}
          placeholder="YYYY"
          maxLength={4}
        />
      </div>
      <div className="field field-filename">
        <label>Filename</label>
        <div className="filename-display" title={photo.name}>
          {previewSrc ? (
            <img src={previewSrc} alt="" className="filename-thumb" loading="lazy" decoding="async" />
          ) : (
            <div className="filename-thumb filename-thumb-placeholder" aria-hidden="true" />
          )}
          <span className="filename-text">
            <span className="filename-base">{getBaseName(photo.name)}</span>
            <span className="filename-ext">{getExtension(photo.name)}</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-outline delete-btn"
        onClick={onRemove}
        aria-label="Remove photo"
        title="Remove photo"
      >
        <svg
          className="delete-icon"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 3 L13 13 M13 3 L3 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </svg>
      </button>
    </div>
  );
}

function getBaseName(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function getExtension(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}
