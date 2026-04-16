import { useMemo } from 'react';
import MetaPhotoRow from '../components/MetaPhotoRow';
import ToolTabs from '../components/ToolTabs';
import ProcessingScreen from './ProcessingScreen';
import ConfirmationScreen from './ConfirmationScreen';
import { appAPI } from '../web/appApi';

const SCREENS = { INTAKE: 'intake', PROCESSING: 'processing', CONFIRMATION: 'confirmation' };

const FORMAT_OPTIONS = [
  {
    id: 'ogLandscape',
    label: 'Facebook Image Post (1200 × 630 JPEG)',
    shortLabel: 'Facebook Image Post',
    width: 1200,
    height: 630,
    key: 'ogLandscape',
    suffixKey: 'ogLandscapeSuffix',
  },
  {
    id: 'twitterLarge',
    label: 'Twitter Post Image (1200 × 675 JPEG)',
    shortLabel: 'Twitter Post Image',
    width: 1200,
    height: 675,
    key: 'twitterLarge',
    suffixKey: 'twitterLargeSuffix',
  },
  {
    id: 'ogSquare',
    label: 'Square Social Post (1200 × 1200 JPEG)',
    shortLabel: 'Square Social Post',
    width: 1200,
    height: 1200,
    key: 'ogSquare',
    suffixKey: 'ogSquareSuffix',
  },
];

function stripSpaces(value) {
  return String(value).replace(/\s+/g, '');
}

function rowValid(p) {
  return p.baseName.trim() !== '';
}

function atLeastOneFormat(formats) {
  return formats.ogLandscape || formats.ogSquare || formats.twitterLarge;
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

function defaultBaseName(filename) {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return stripSpaces(stem);
}

export default function MetaImageIntakeScreen({
  activeTab,
  onTabChange,
  photos,
  setPhotos,
  formats,
  setFormats,
  onSubmit,
  screen = SCREENS.INTAKE,
  processingResult = null,
  processingTotal = 0,
  onReset,
}) {
  const allRowsValid = useMemo(() => photos.length > 0 && photos.every(rowValid), [photos]);
  const canSubmit = allRowsValid && atLeastOneFormat(formats);

  const selectedFormats = useMemo(
    () => FORMAT_OPTIONS.filter((opt) => formats[opt.key]),
    [formats]
  );

  const handleAddPhotos = async () => {
    const selected = await appAPI.selectPhotos();
    setPhotos((prev) => {
      const existing = new Set(prev.map(buildExistingPhotoKey));
      const toAdd = selected
        .filter((item) => !existing.has(buildSelectedPhotoKey(item)))
        .map((item) => {
          const path = typeof item === 'string' ? item : item.path;
          const file = typeof item === 'object' && item.file ? item.file : null;
          const name = path.split(/[/\\]/).pop();
          return {
            id: `${buildSelectedPhotoKey(item)}:${Date.now()}:${Math.random()}`,
            path,
            name,
            ...(file && { file }),
            baseName: defaultBaseName(name),
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
      <section className="intake-intro">
        <h1 className="display-heading">
          Generate meta image assets for any web page.
        </h1>
        <p className="intro-copy">
          Upload hero imagery, set a base filename, and the app will export a consistent set of meta tag images at the sizes used by Open Graph and Twitter cards.
        </p>
        <ToolTabs activeTab={activeTab} onChange={onTabChange} />
      </section>

      <section className="intake-form">
        {screen === SCREENS.PROCESSING ? (
          <ProcessingScreen total={processingTotal} />
        ) : screen === SCREENS.CONFIRMATION ? (
          <ConfirmationScreen
            result={processingResult}
            onReset={onReset}
            itemLabel="meta images"
          />
        ) : (
          <>
        <div className="form-section">
          <div className="form-section-head">
            <h2>Upload images to get started.</h2>
          </div>
          {photos.length === 0 ? (
            <div className="form-empty">
              <p className="form-empty-text">No images added yet.</p>
              <button type="button" className="btn btn-primary" onClick={handleAddPhotos}>
                Add Images
              </button>
            </div>
          ) : (
            <>
              <div className="photo-rows">
                {photos.map((p) => (
                  <MetaPhotoRow
                    key={p.id}
                    photo={p}
                    onChange={(updates) => updatePhoto(p.id, updates)}
                    onRemove={() => removePhoto(p.id)}
                    valid={rowValid(p)}
                    selectedFormats={selectedFormats}
                  />
                ))}
              </div>
              <div className="add-photos-row">
                <button type="button" className="btn btn-primary" onClick={handleAddPhotos}>
                  Add Images
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
          </>
        )}
      </section>
    </div>
  );
}
