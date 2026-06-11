import { Alert } from 'react-bootstrap';

export default function SitePreview({ html, title = 'Generated website preview' }) {
  if (!html) {
    return (
      <Alert variant="light" className="border-0 mb-0">
        No generated HTML is available for this project yet.
      </Alert>
    );
  }

  return (
    <div className="preview-shell">
      <div className="preview-browser-bar">
        <span />
        <span />
        <span />
        <strong>{title}</strong>
      </div>
      <iframe
        title={title}
        className="site-preview-frame"
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
