import { useMemo } from 'react';
import PhotoRow from '../components/PhotoRow';
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
    <div className="intake-grid">
      <section className="intake-lede">
        <h1 className="display-heading">
          Prepare a consistent export set for the web.
        </h1>
        <p className="lede-copy">
          Upload headshots, confirm naming details, and choose which Atomic-ready formats to generate. Each photo is automatically aligned and cropped into a standardized portrait.
        </p>
        <span className="accent-rule" aria-hidden="true" />
      </section>

      <section className="intake-form">
        <div className="form-section">
          <div className="form-section-head">
            <h2>Upload photos to get started.</h2>
          </div>
          {photos.length === 0 ? (
            <div className="form-empty">
              <p className="form-empty-text">No photos added yet.</p>
              <button type="button" className="btn btn-primary" onClick={handleAddPhotos}>
                Add Photos
              </button>
            </div>
          ) : (
            <>
              <div className="photo-rows">
                {photos.map((p) => (
                  <PhotoRow
                    key={p.id}
                    photo={p}
                    onChange={(updates) => updatePhoto(p.id, updates)}
                    onRemove={() => removePhoto(p.id)}
                    valid={rowValid(p)}
                  />
                ))}
              </div>
              <div className="add-photos-row">
                <button type="button" className="btn btn-primary" onClick={handleAddPhotos}>
                  Add Photos
                </button>
              </div>
            </>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h2>Output Formats</h2>
          </div>
          <p className="form-hint">Choose at least one format and adjust its filename suffix.</p>
          <div className="format-list">
            {FORMAT_OPTIONS.map((opt) => (
              <div key={opt.id} className="format-option">
                <input
                  id={`${opt.id}-checkbox`}
                  className="format-checkbox"
                  type="checkbox"
                  checked={formats[opt.key]}
                  onChange={(e) => setFormats({ ...formats, [opt.key]: e.target.checked })}
                />
                <label className="format-suffix-label" htmlFor={`${opt.id}-suffix`}>
                  <input
                    id={`${opt.id}-suffix`}
                    type="text"
                    value={formats[opt.suffixKey]}
                    onChange={(e) =>
                      setFormats({ ...formats, [opt.suffixKey]: stripSpaces(e.target.value) })
                    }
                    placeholder="Suffix"
                  />
                </label>
                <label className="checkbox-label" htmlFor={`${opt.id}-checkbox`}>
                  <span>{opt.label}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="form-submit">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            Generate Exports
          </button>
        </div>
      </section>
    </div>
  );
}
