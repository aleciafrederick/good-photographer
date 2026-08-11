import { useState, useCallback } from 'react';
import IntakeScreen from './screens/IntakeScreen';
import MetaImageIntakeScreen from './screens/MetaImageIntakeScreen';
import QrCodeScreen from './screens/QrCodeScreen';
import { appAPI } from './web/appApi';

const SCREENS = { INTAKE: 'intake', PROCESSING: 'processing', CONFIRMATION: 'confirmation' };
const TABS = { HEADSHOTS: 'headshots', META: 'meta', QR: 'qr' };

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

  const [headshotPhotos, setHeadshotPhotos] = useState([]);
  const [headshotFormats, setHeadshotFormats] = useState(DEFAULT_HEADSHOT_FORMATS);
  const [headshotScreen, setHeadshotScreen] = useState(SCREENS.INTAKE);
  const [headshotResult, setHeadshotResult] = useState(null);
  const [headshotTotal, setHeadshotTotal] = useState(0);

  const [metaPhotos, setMetaPhotos] = useState([]);
  const [metaFormats, setMetaFormats] = useState(DEFAULT_META_FORMATS);
  const [metaScreen, setMetaScreen] = useState(SCREENS.INTAKE);
  const [metaResult, setMetaResult] = useState(null);
  const [metaTotal, setMetaTotal] = useState(0);

  const [qrText, setQrText] = useState('');
  const [qrColor, setQrColor] = useState('#4c4845');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrError, setQrError] = useState(null);

  const handleSubmitHeadshots = useCallback(async () => {
    setHeadshotTotal(headshotPhotos.length);
    setHeadshotScreen(SCREENS.PROCESSING);

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
      setHeadshotResult(result);
      setHeadshotScreen(SCREENS.CONFIRMATION);
    } catch (err) {
      setHeadshotResult({ success: false, downloaded: false, errors: [err.message] });
      setHeadshotScreen(SCREENS.CONFIRMATION);
    }
  }, [headshotPhotos, headshotFormats]);

  const handleSubmitMeta = useCallback(async () => {
    setMetaTotal(metaPhotos.length);
    setMetaScreen(SCREENS.PROCESSING);

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
      setMetaResult(result);
      setMetaScreen(SCREENS.CONFIRMATION);
    } catch (err) {
      setMetaResult({ success: false, downloaded: false, errors: [err.message] });
      setMetaScreen(SCREENS.CONFIRMATION);
    }
  }, [metaPhotos, metaFormats]);

  const handleResetHeadshots = useCallback(() => {
    setHeadshotPhotos([]);
    setHeadshotFormats(DEFAULT_HEADSHOT_FORMATS);
    setHeadshotResult(null);
    setHeadshotTotal(0);
    setHeadshotScreen(SCREENS.INTAKE);
  }, []);

  const handleResetMeta = useCallback(() => {
    setMetaPhotos([]);
    setMetaFormats(DEFAULT_META_FORMATS);
    setMetaResult(null);
    setMetaTotal(0);
    setMetaScreen(SCREENS.INTAKE);
  }, []);

  let content;
  if (tab === TABS.META) {
    content = (
      <MetaImageIntakeScreen
        activeTab={tab}
        onTabChange={setTab}
        photos={metaPhotos}
        setPhotos={setMetaPhotos}
        formats={metaFormats}
        setFormats={setMetaFormats}
        onSubmit={handleSubmitMeta}
        screen={metaScreen}
        processingResult={metaResult}
        processingTotal={metaTotal}
        onReset={handleResetMeta}
      />
    );
  } else if (tab === TABS.QR) {
    content = (
      <QrCodeScreen
        activeTab={tab}
        onTabChange={setTab}
        text={qrText}
        setText={setQrText}
        color={qrColor}
        setColor={setQrColor}
        qrDataUrl={qrDataUrl}
        setQrDataUrl={setQrDataUrl}
        error={qrError}
        setError={setQrError}
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
        screen={headshotScreen}
        processingResult={headshotResult}
        processingTotal={headshotTotal}
        onReset={handleResetHeadshots}
      />
    );
  }

  return <AppShell>{content}</AppShell>;
}
