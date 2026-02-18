import { useMemo } from 'react';
import PhotoRow from '../components/PhotoRow';
import logo from '../assets/logo.png';

const FORMAT_OPTIONS = [
  { id: 'websiteBio', label: 'Website Bio (1000 × 684 JPEG)', key: 'websiteBio' },
  { id: 'spinBio', label: 'Spin Bio (510 × 510 JPEG)', key: 'spinBio' },
  { id: 'nucleusRound', label: 'Nucleus Round (510 × 510 PNG, circular mask)', key: 'nucleusRound' },
];

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

export default function IntakeScreen({ photos, setPhotos, formats, setFormats, onSubmit }) {
  const allRowsValid = useMemo(() => photos.length > 0 && photos.every(rowValid), [photos]);
  const canSubmit = allRowsValid && atLeastOneFormat(formats);

  const handleAddPhotos = async () => {
    const paths = await window.electronAPI.selectPhotos();
    const year = new Date().getFullYear();
    setPhotos((prev) => {
      const existing = new Set(prev.map((p) => p.path));
      const toAdd = paths.filter((p) => !existing.has(p)).map((filePath) => ({
        id: filePath + Date.now(),
        path: filePath,
        name: filePath.split(/[/\\]/).pop(),
        firstName: '',
        lastName: '',
        year,
      }));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  };

  const updatePhoto = (id, updates) => {
    setPhotos(photos.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePhoto = (id) => {
    setPhotos(photos.filter((p) => p.id !== id));
  };

  return (
    <div className="intake">
      <img src={logo} alt="GoodPhotographer" className="intake-logo" />
      <h1>GoodPhotographer</h1>
      <p className="description">
        Batch-process headshots: normalize alignment to a template and export standardized image formats.
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
          <label key={opt.id} className="checkbox-label">
            <input
              type="checkbox"
              checked={formats[opt.key]}
              onChange={(e) => setFormats({ ...formats, [opt.key]: e.target.checked })}
            />
            <span>{opt.label}</span>
          </label>
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
