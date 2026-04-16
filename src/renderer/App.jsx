import { useState, useCallback } from 'react';
import IntakeScreen from './screens/IntakeScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';
import { appAPI } from './web/appApi';

const SCREENS = { INTAKE: 'intake', PROCESSING: 'processing', CONFIRMATION: 'confirmation' };
const DEFAULT_FORMATS = {
  websiteBio: true,
  websiteBioSuffix: 'Bio',
  spinBio: true,
  spinBioSuffix: 'Spin',
  nucleusRound: true,
  nucleusRoundSuffix: 'Nucleus',
};

function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-wordmark">
          <span className="app-wordmark-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
              <path
                d="M9 5 H15 L16.5 7 H20 A1.5 1.5 0 0 1 21.5 8.5 V18 A1.5 1.5 0 0 1 20 19.5 H4 A1.5 1.5 0 0 1 2.5 18 V8.5 A1.5 1.5 0 0 1 4 7 H7.5 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="13"
                r="3.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </span>
          <span className="app-wordmark-text">Atomic Photographer</span>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.INTAKE);
  const [photos, setPhotos] = useState([]);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [processingResult, setProcessingResult] = useState(null);

  const handleSubmit = useCallback(async () => {
    setScreen(SCREENS.PROCESSING);

    const formatList = [];
    if (formats.websiteBio) {
      formatList.push({ id: 'website_bio', suffix: formats.websiteBioSuffix });
    }
    if (formats.spinBio) {
      formatList.push({ id: 'spin_bio', suffix: formats.spinBioSuffix });
    }
    if (formats.nucleusRound) {
      formatList.push({ id: 'nucleus_round', suffix: formats.nucleusRoundSuffix });
    }

    const payload = {
      photos: photos.map((p) => ({
        path: p.path,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        year: String(p.year).trim(),
        ...(p.file && { file: p.file }),
      })),
      formats: formatList,
    };

    try {
      const result = await appAPI.runProcessor(payload);
      setProcessingResult(result);
      setScreen(SCREENS.CONFIRMATION);
    } catch (err) {
      setProcessingResult({ success: false, downloaded: false, errors: [err.message] });
      setScreen(SCREENS.CONFIRMATION);
    }
  }, [photos, formats]);

  const handleReset = useCallback(() => {
    setPhotos([]);
    setFormats(DEFAULT_FORMATS);
    setProcessingResult(null);
    setScreen(SCREENS.INTAKE);
  }, []);

  let content;
  if (screen === SCREENS.PROCESSING) {
    content = <ProcessingScreen total={photos.length} />;
  } else if (screen === SCREENS.CONFIRMATION) {
    content = <ConfirmationScreen result={processingResult} onReset={handleReset} />;
  } else {
    content = (
      <IntakeScreen
        photos={photos}
        setPhotos={setPhotos}
        formats={formats}
        setFormats={setFormats}
        onSubmit={handleSubmit}
      />
    );
  }

  return <AppShell>{content}</AppShell>;
}
