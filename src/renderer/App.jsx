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

  if (screen === SCREENS.PROCESSING) {
    return <ProcessingScreen total={photos.length} />;
  }
  if (screen === SCREENS.CONFIRMATION) {
    return <ConfirmationScreen result={processingResult} onReset={handleReset} />;
  }

  return (
    <IntakeScreen
      photos={photos}
      setPhotos={setPhotos}
      formats={formats}
      setFormats={setFormats}
      onSubmit={handleSubmit}
    />
  );
}
