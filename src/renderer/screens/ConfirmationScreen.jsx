export default function ConfirmationScreen({ result, onReset, itemLabel = 'images' }) {
  const success = result?.success !== false;
  const hasErrors = result?.errors?.length > 0;
  const downloaded = result?.downloaded === true;

  return (
    <section className="status-screen">
      <h1 className="display-heading">
        {success ? 'Your export set is ready.' : 'Finished with some issues.'}
      </h1>
      <p className="status-copy">
        {success
          ? downloaded
            ? `Your ${itemLabel} have been processed and your zip file has been downloaded.`
            : `Your ${itemLabel} have been processed.`
          : `Some ${itemLabel} finished with warnings. Review the notes below before using the set.`}
      </p>

      {hasErrors && (
        <div className="errors">
          <p className="errors-label">Notes</p>
          <ul>
            {result.errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="status-actions">
        <button type="button" className="btn btn-outline" onClick={onReset}>
          Start Another Batch
        </button>
      </div>
    </section>
  );
}
