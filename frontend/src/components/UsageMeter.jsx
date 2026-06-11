import { useEffect, useState } from 'react';
import { Alert, Card, ProgressBar, Spinner } from 'react-bootstrap';
import { getUsage } from '../api/client';

export default function UsageMeter({ refreshKey = 0 }) {
  const [usage, setUsage] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadUsage({ showLoading = false } = {}) {
    if (showLoading) {
      setIsLoading(true);
    }

    setError('');

    try {
      const nextUsage = await getUsage();
      setUsage(nextUsage || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load AI usage.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsage({ showLoading: true });

    const intervalId = window.setInterval(() => {
      loadUsage();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (refreshKey > 0) {
      loadUsage();
    }
  }, [refreshKey]);

  return (
    <Card className="app-card usage-meter-card">
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h2 className="h5 fw-bold mb-1">AI usage today</h2>
            <p className="muted-copy mb-0">Daily usage counted from generated projects.</p>
          </div>
          {isLoading && <Spinner animation="border" size="sm" variant="info" />}
        </div>

        {error && <Alert variant="warning">{error}</Alert>}

        <div className="d-grid gap-3">
          {usage.map((item) => {
            const ratio = item.limit > 0 ? item.used / item.limit : 0;

            return (
              <div key={item.id}>
                <ProgressBar
                  now={item.used}
                  max={item.limit}
                  label={`${item.label} : ${item.used} / ${item.limit}`}
                  variant={ratio > 0.8 ? 'danger' : 'info'}
                />
              </div>
            );
          })}
        </div>

        <small className="d-block muted-copy mt-3">
          Estimation based on SynthoSite projects generated today. Provider-side quotas may differ.
        </small>
      </Card.Body>
    </Card>
  );
}
