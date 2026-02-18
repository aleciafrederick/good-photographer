export default function ConfirmationScreen({ exportDir, result, onOpenFolder, onReset }) {
  const success = result?.success !== false;
  const hasErrors = result?.errors?.length > 0;

  return (
    <div className="confirmation">
      <h1>{success ? 'Done' : 'Processing finished'}</h1>
      <p>
        {success
          ? 'Your headshots have been processed and saved.'
          : 'Processing completed with some issues.'}
      </p>
      {hasErrors && (
        <div className="errors">
          <strong>Notes:</strong>
          <ul>
            {result.errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        {exportDir && (
          <button type="button" onClick={onOpenFolder}>
            Open export folder
          </button>
        )}
        <button type="button" className="secondary" onClick={onReset}>
          Start over
        </button>
      </div>
    </div>
  );
}
