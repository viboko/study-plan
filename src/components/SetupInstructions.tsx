/** How to create the Google OAuth client ID this site needs. Mirrors the README. */
export function SetupInstructions() {
  const origin = window.location.origin;
  return (
    <details className="setup">
      <summary>How to get a client ID (about 10 minutes, free)</summary>
      <ol>
        <li>
          Open the{' '}
          <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
            Google Cloud console
          </a>{' '}
          and create a new project (any name, e.g. “Study Plan”).
        </li>
        <li>
          Under <em>APIs &amp; Services → Library</em>, enable three APIs:{' '}
          <strong>Google Sheets API</strong>, <strong>Google Drive API</strong> and{' '}
          <strong>Google Calendar API</strong>.
        </li>
        <li>
          Under <em>Google Auth Platform</em> (the OAuth consent screen), choose{' '}
          <strong>External</strong>, fill in the app name and your email, and add your own Google
          account under <em>Audience → Test users</em>. Leave the app in “Testing”.
        </li>
        <li>
          Under <em>Clients</em>, create an OAuth client of type <strong>Web application</strong>.
          Add this under <em>Authorised JavaScript origins</em>:
          <br />
          <code>{origin}</code>
        </li>
        <li>
          Copy the client ID (it ends in <code>.apps.googleusercontent.com</code>) and paste it
          above. It is not a secret, and it is only stored in this browser.
        </li>
      </ol>
      <p>
        The first time you connect, Google warns that the app isn’t verified: choose{' '}
        <em>Continue</em>. The site asks for two permissions only: files it creates itself (one
        spreadsheet called “Study Plan”) and calendars it creates itself (one per child). It cannot
        see the rest of your Drive or your other calendars.
      </p>
    </details>
  );
}
