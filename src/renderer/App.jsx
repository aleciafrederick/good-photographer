import { useState, useCallback } from 'react';
import IntakeScreen from './screens/IntakeScreen';
import MetaImageIntakeScreen from './screens/MetaImageIntakeScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';
import { appAPI } from './web/appApi';

const SCREENS = { INTAKE: 'intake', PROCESSING: 'processing', CONFIRMATION: 'confirmation' };
const TABS = { HEADSHOTS: 'headshots', META: 'meta' };

const DEFAULT_HEADSHOT_FORMATS = {
  websiteBio: true,
  websiteBioSuffix: 'Bio',
  spinBio: true,
  spinBioSuffix: 'Spin',
  nucleusRound: true,
  nucleusRoundSuffix: 'Nucleus',
};

const DEFAULT_META_FORMATS = {
  ogLandscape: true,
  ogLandscapeSuffix: 'OG',
  ogSquare: false,
  ogSquareSuffix: 'OGSquare',
  twitterLarge: true,
  twitterLargeSuffix: 'Twitter',
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
  const [tab, setTab] = useState(TABS.HEADSHOTS);
  const [screen, setScreen] = useState(SCREENS.INTAKE);
  const [processingResult, setProcessingResult] = useState(null);
  const [processingTotal, setProcessingTotal] = useState(0);

  const [headshotPhotos, setHeadshotPhotos] = useState([]);
  const [headshotFormats, setHeadshotFormats] = useState(DEFAULT_HEADSHOT_FORMATS);

  const [metaPhotos, setMetaPhotos] = useState([]);
  const [metaFormats, setMetaFormats] = useState(DEFAULT_META_FORMATS);

  const handleSubmitHeadshots = useCallback(async () => {
    setProcessingTotal(headshotPhotos.length);
    setScreen(SCREENS.PROCESSING);

    const formatList = [];
    if (headshotFormats.websiteBio) {
      formatList.push({ id: 'website_bio', suffix: headshotFormats.websiteBioSuffix });
    }
    if (headshotFormats.spinBio) {
      formatList.push({ id: 'spin_bio', suffix: headshotFormats.spinBioSuffix });
    }
    if (headshotFormats.nucleusRound) {
      formatList.push({ id: 'nucleus_round', suffix: headshotFormats.nucleusRoundSuffix });
    }

    const payload = {
      photos: headshotPhotos.map((p) => ({
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
  }, [headshotPhotos, headshotFormats]);

  const handleSubmitMeta = useCallback(async () => {
    setProcessingTotal(metaPhotos.length);
    setScreen(SCREENS.PROCESSING);

    const formatList = [];
    if (metaFormats.ogLandscape) {
      formatList.push({ id: 'og_landscape', suffix: metaFormats.ogLandscapeSuffix });
    }
    if (metaFormats.ogSquare) {
      formatList.push({ id: 'og_square', suffix: metaFormats.ogSquareSuffix });
    }
    if (metaFormats.twitterLarge) {
      formatList.push({ id: 'twitter_large', suffix: metaFormats.twitterLargeSuffix });
    }

    const payload = {
      photos: metaPhotos.map((p) => ({
        path: p.path,
        baseName: p.baseName.trim(),
        ...(p.file && { file: p.file }),
      })),
      formats: formatList,
    };

    try {
      const result = await appAPI.runMetaProcessor(payload);
      setProcessingResult(result);
      setScreen(SCREENS.CONFIRMATION);
    } catch (err) {
      setProcessingResult({ success: false, downloaded: false, errors: [err.message] });
      setScreen(SCREENS.CONFIRMATION);
    }
  }, [metaPhotos, metaFormats]);

  const handleReset = useCallback(() => {
    if (tab === TABS.META) {
      setMetaPhotos([]);
      setMetaFormats(DEFAULT_META_FORMATS);
    } else {
      setHeadshotPhotos([]);
      setHeadshotFormats(DEFAULT_HEADSHOT_FORMATS);
    }
    setProcessingResult(null);
    setProcessingTotal(0);
    setScreen(SCREENS.INTAKE);
  }, [tab]);

  let content;
  if (screen === SCREENS.PROCESSING) {
    content = <ProcessingScreen total={processingTotal} />;
  } else if (screen === SCREENS.CONFIRMATION) {
    content = (
      <ConfirmationScreen
        result={processingResult}
        onReset={handleReset}
        itemLabel={tab === TABS.META ? 'meta images' : 'headshots'}
      />
    );
  } else if (tab === TABS.META) {
    content = (
      <MetaImageIntakeScreen
        activeTab={tab}
        onTabChange={setTab}
        photos={metaPhotos}
        setPhotos={setMetaPhotos}
        formats={metaFormats}
        setFormats={setMetaFormats}
        onSubmit={handleSubmitMeta}
      />
    );
  } else {
    content = (
      <IntakeScreen
        activeTab={tab}
        onTabChange={setTab}
        photos={headshotPhotos}
        setPhotos={setHeadshotPhotos}
        formats={headshotFormats}
        setFormats={setHeadshotFormats}
        onSubmit={handleSubmitHeadshots}
      />
    );
  }

  return <AppShell>{content}</AppShell>;
}
