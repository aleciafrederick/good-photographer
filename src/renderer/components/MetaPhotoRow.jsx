import { useEffect, useMemo, useState } from 'react';
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

export default function MetaPhotoRow({ photo, onChange, onRemove, valid, selectedFormats = [] }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const cached = getCachedPreview(photo);
    if (cached) {
      setPreview(cached);
      return undefined;
    }

    setPreview(null);
    let cancelled = false;

    const cancelScheduledLoad = schedulePreviewLoad(() => {
      if (cancelled) return;

      enqueuePreviewJob(() => createTinyPreview(photo))
        .then((result) => {
          if (cancelled || !result) return;
          storeCachedPreview(photo, result);
          setPreview(result);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, [photo.file, photo.path]);

  const sourceExt = getExtension(photo.name);
  const previewName = photo.baseName ? `${photo.baseName}${sourceExt}` : photo.name;

  const upscaledFormats = useMemo(() => {
    if (!preview || !selectedFormats.length) return [];
    return selectedFormats.filter(
      (f) => preview.width < f.width || preview.height < f.height
    );
  }, [preview, selectedFormats]);

  return (
    <div className={`photo-row meta-photo-row ${valid ? '' : 'invalid'}`}>
      <div className="field field-basename">
        <label>Filename*</label>
        <input
          value={photo.baseName}
          onChange={(e) => onChange({ baseName: stripSpaces(e.target.value) })}
          placeholder="e.g. homepage-hero"
        />
      </div>
      <div className="field field-filename">
        <label>Uploaded File</label>
        <div className="filename-display" title={previewName}>
          {preview?.dataUrl ? (
            <img
              src={preview.dataUrl}
              alt=""
              className="filename-thumb"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="filename-thumb filename-thumb-placeholder" aria-hidden="true" />
          )}
          <span className="filename-text">
            <span className="filename-base">{getBaseName(previewName)}</span>
            <span className="filename-ext">{getExtension(previewName)}</span>
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
      {upscaledFormats.length > 0 && (
        <p className="photo-row-warning" role="note">
          <svg
            className="photo-row-warning-icon"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M8 1.5 L15 14 L1 14 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M8 6 L8 10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="8" cy="12" r="0.9" fill="currentColor" />
          </svg>
          <span>
            Source is {preview.width} × {preview.height}. It will be upscaled to fit{' '}
            {formatFormatList(upscaledFormats)} and may look soft.
          </span>
        </p>
      )}
    </div>
  );
}

function formatFormatList(formats) {
  const labels = formats.map((f) => f.shortLabel || f.label);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
