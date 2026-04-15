import { useState, useCallback } from 'react';
import IntakeScreen from './screens/IntakeScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

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
  const [exportDir, setExportDir] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);

  const handleSubmit = useCallback(async () => {
    const exportDirPath = await window.electronAPI.getExportDir();
    setExportDir(exportDirPath);
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
      exportDir: exportDirPath,
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
      const result = await window.electronAPI.runProcessor(payload);
      setProcessingResult(result);
      setScreen(SCREENS.CONFIRMATION);
    } catch (err) {
      setProcessingResult({ success: false, exportDir: exportDirPath, errors: [err.message] });
      setScreen(SCREENS.CONFIRMATION);
    }
  }, [photos, formats]);

  const handleReset = useCallback(() => {
    setPhotos([]);
    setFormats(DEFAULT_FORMATS);
    setExportDir(null);
    setProcessingResult(null);
    setScreen(SCREENS.INTAKE);
  }, []);

  const openFolder = useCallback(() => {
    if (exportDir) window.electronAPI.openExportFolder(exportDir);
  }, [exportDir]);

  if (screen === SCREENS.PROCESSING) {
    return <ProcessingScreen total={photos.length} />;
  }
  if (screen === SCREENS.CONFIRMATION) {
    return (
      <ConfirmationScreen
        exportDir={exportDir}
        result={processingResult}
        onOpenFolder={openFolder}
        onReset={handleReset}
      />
    );
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
