export default function PhotoRow({ photo, onChange, onRemove, valid }) {
  return (
    <div className={`photo-row ${valid ? '' : 'invalid'}`}>
      <div className="field">
        <label>First Name *</label>
        <input
          value={photo.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          placeholder="First name"
        />
      </div>
      <div className="field">
        <label>Last Name *</label>
        <input
          value={photo.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
          placeholder="Last name"
        />
      </div>
      <div className="field year">
        <label>Year</label>
        <input
          value={photo.year}
          onChange={(e) => onChange({ year: e.target.value })}
          placeholder="YYYY"
          maxLength={4}
        />
      </div>
      <div className="field photo-row-filename">
        <label>Filename</label>
        <input
          type="text"
          value={photo.name}
          readOnly
          title={photo.name}
          className="filename-input"
        />
      </div>
      <button type="button" className="delete-btn" onClick={onRemove} title="Remove">
        Remove
      </button>
    </div>
  );
}
