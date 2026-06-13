import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import client, { API_PUBLIC_ORIGIN } from '../api/client';
import SitePreview from '../components/SitePreview';

export default function AdminProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const publicUrl = useMemo(() => `${API_PUBLIC_ORIGIN}/p/${id}`, [id]);

  useEffect(() => {
    let isCurrent = true;

    async function fetchProject() {
      setIsLoading(true);
      setError('');

      try {
        const response = await client.get(`/admin/projects/${id}`);

        if (isCurrent) {
          setProject(response.data.project);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Unable to load this admin project.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    fetchProject();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <Container className="page-section text-center">
        <Spinner animation="border" variant="info" />
        <p className="muted-copy mt-3 mb-0">Loading project...</p>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container className="page-section">
        <Alert variant="danger">{error || 'Project not found.'}</Alert>
        <Button as={Link} to="/admin" variant="outline-accent">
          Back to admin
        </Button>
      </Container>
    );
  }

  return (
    <Container className="page-section">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div>
          <p className="hero-kicker mb-2">Admin preview</p>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h1 className="fw-bold mb-0">{project.title}</h1>
            <Badge className="type-badge text-capitalize">{project.siteType || 'website'}</Badge>
            <Badge bg={project.isPublic ? 'success' : 'secondary'}>
              {project.isPublic ? 'Public' : 'Private'}
            </Badge>
          </div>
          <p className="muted-copy mt-2 mb-0">
            Owner: {project.ownerUsername} ({project.ownerEmail})
          </p>
        </div>
        <ButtonGroup className="flex-wrap">
          <Button as={Link} to="/admin" variant="outline-secondary">
            Admin
          </Button>
          <Button
            href={project.isPublic ? publicUrl : undefined}
            target="_blank"
            rel="noreferrer"
            variant="outline-accent"
            disabled={!project.isPublic}
          >
            Public URL
          </Button>
        </ButtonGroup>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4">
        <Col xl={8}>
          <Card className="app-card">
            <Card.Body className="p-3 p-md-4">
              <h2 className="h4 fw-bold mb-1">Generated preview</h2>
              <p className="muted-copy mb-3">Read-only admin access to this generated site.</p>
              <SitePreview html={project.generatedCode} title={project.title} />
            </Card.Body>
          </Card>
        </Col>
        <Col xl={4}>
          <Card className="app-card">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">Project details</h2>
              <dl className="admin-project-details mb-0">
                <dt>Description</dt>
                <dd>{project.description || 'No description'}</dd>
                <dt>Model</dt>
                <dd>{project.modelUsed || 'Unknown'}</dd>
                <dt>Visibility</dt>
                <dd>{project.isPublic ? 'Public' : 'Private'}</dd>
                <dt>Prompt</dt>
                <dd>{project.prompt}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
