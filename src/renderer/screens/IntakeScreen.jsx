import { useMemo } from 'react';
import PhotoRow from '../components/PhotoRow';
import logo from '../assets/logo.png';
import { appAPI } from '../web/appApi';

const FORMAT_OPTIONS = [
  {
    id: 'websiteBio',
    label: 'Website Bio (1024 × 683 JPEG)',
    key: 'websiteBio',
    suffixKey: 'websiteBioSuffix',
  },
  {
    id: 'spinBio',
    label: 'Spin Bio (510 × 510 JPEG)',
    key: 'spinBio',
    suffixKey: 'spinBioSuffix',
  },
  {
    id: 'nucleusRound',
    label: 'Nucleus Round (510 × 510 PNG, circular mask)',
    key: 'nucleusRound',
    suffixKey: 'nucleusRoundSuffix',
  },
];

function stripSpaces(value) {
  return String(value).replace(/\s+/g, '');
}

function validYear(year) {
  const y = String(year).trim();
  return /^\d{4}$/.test(y);
}

function rowValid(p) {
  return (
    p.firstName.trim() !== '' &&
    p.lastName.trim() !== '' &&
    validYear(p.year)
  );
}

function atLeastOneFormat(formats) {
  return formats.websiteBio || formats.spinBio || formats.nucleusRound;
}

function buildSelectedPhotoKey(item) {
  if (item && typeof item === 'object' && item.file instanceof File) {
    return `${item.file.name}:${item.file.size}:${item.file.lastModified}`;
  }

  const path = typeof item === 'string' ? item : item?.path;
  return String(path || '');
}

function buildExistingPhotoKey(photo) {
  if (photo.file instanceof File) {
    return `${photo.file.name}:${photo.file.size}:${photo.file.lastModified}`;
  }

  return String(photo.path || '');
}

export default function IntakeScreen({ photos, setPhotos, formats, setFormats, onSubmit }) {
  const allRowsValid = useMemo(() => photos.length > 0 && photos.every(rowValid), [photos]);
  const canSubmit = allRowsValid && atLeastOneFormat(formats);

  const handleAddPhotos = async () => {
    const selected = await appAPI.selectPhotos();
    const year = new Date().getFullYear();
    setPhotos((prev) => {
      const existing = new Set(prev.map(buildExistingPhotoKey));
      const toAdd = selected
        .filter((item) => !existing.has(buildSelectedPhotoKey(item)))
        .map((item) => {
          const path = typeof item === 'string' ? item : item.path;
          const file = typeof item === 'object' && item.file ? item.file : null;
          return {
            id: `${buildSelectedPhotoKey(item)}:${Date.now()}:${Math.random()}`,
            path,
            name: path.split(/[/\\]/).pop(),
            ...(file && { file }),
            firstName: '',
            lastName: '',
            year,
          };
        });
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  };

  const updatePhoto = (id, updates) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="intake">
      <img src={logo} alt="GoodPhotographer" className="intake-logo" />
      <h1>GoodPhotographer</h1>
      <p className="description">
        Upload a headshot photo, and the app automatically centers, aligns, and crops it into a standardized portrait. Export in Website Bio, Spin Bio, or Nucleus Round formats. 
      </p>

      <button type="button" onClick={handleAddPhotos}>
        Add Photos
      </button>

      {photos.length > 0 && (
        <section className="photo-list">
          <h2>Photos</h2>
          {photos.map((p) => (
            <PhotoRow
              key={p.id}
              photo={p}
              onChange={(updates) => updatePhoto(p.id, updates)}
              onRemove={() => removePhoto(p.id)}
              valid={rowValid(p)}
            />
          ))}
        </section>
      )}

      <section className="formats">
        <h2>Output format</h2>
        <p className="formats-hint">At least one format must be selected.</p>
        {FORMAT_OPTIONS.map((opt) => (
          <div key={opt.id} className="format-option">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formats[opt.key]}
                onChange={(e) => setFormats({ ...formats, [opt.key]: e.target.checked })}
              />
              <span>{opt.label}</span>
            </label>
            <label className="format-suffix-label">
              <span>Extension text</span>
              <input
                type="text"
                value={formats[opt.suffixKey]}
                onChange={(e) => setFormats({ ...formats, [opt.suffixKey]: stripSpaces(e.target.value) })}
                placeholder="Enter filename suffix"
              />
            </label>
          </div>
        ))}
      </section>

      <div className="submit-row">
        <button type="button" onClick={onSubmit} disabled={!canSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
}
