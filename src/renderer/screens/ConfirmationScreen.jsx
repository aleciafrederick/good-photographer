export default function ConfirmationScreen({ result, onReset }) {
  const success = result?.success !== false;
  const hasErrors = result?.errors?.length > 0;
  const downloaded = result?.downloaded === true;

  return (
    <div className="confirmation">
      <h1>{success ? 'Done' : 'Processing finished'}</h1>
      <p>
        {success
          ? downloaded
            ? 'Your headshots have been processed and your zip file has been downloaded.'
            : 'Your headshots have been processed.'
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
        {downloaded && success && (
          <p className="browser-download-note">Your zip file has been downloaded.</p>
        )}
        <button type="button" className="secondary" onClick={onReset}>
          Start over
        </button>
      </div>
    </div>
  );
}
