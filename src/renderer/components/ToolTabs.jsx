const TABS = [
  { id: 'headshots', label: 'Headshot Formatter' },
  { id: 'meta', label: 'Meta Image Generator' },
  { id: 'qr', label: 'QR Code Generator' },
];

export default function ToolTabs({ activeTab, onChange }) {
  return (
    <nav className="tool-tabs" aria-label="Tool">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tool-tab${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) onChange(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
