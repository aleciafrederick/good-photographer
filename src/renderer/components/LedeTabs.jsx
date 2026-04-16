const TABS = [
  { id: 'headshots', label: 'Headshot Formatter' },
  { id: 'meta', label: 'Meta Image Generator' },
];

export default function LedeTabs({ activeTab, onChange }) {
  return (
    <nav className="lede-tabs" aria-label="Tool">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`lede-tab${isActive ? ' is-active' : ''}`}
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
