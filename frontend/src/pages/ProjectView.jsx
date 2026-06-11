import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Form,
  Modal,
  Row,
  Spinner
} from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client, { API_PUBLIC_ORIGIN } from '../api/client';
import SitePreview from '../components/SitePreview';

function downloadHtml(project) {
  const blob = new Blob([project.generatedCode || ''], { type: 'text/html;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (project.title || 'synthosite-project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  link.href = objectUrl;
  link.download = `${safeTitle || 'synthosite-project'}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const publicUrl = useMemo(() => `${API_PUBLIC_ORIGIN}/p/${id}`, [id]);

  useEffect(() => {
    let isCurrent = true;

    async function fetchProject() {
      setIsLoading(true);
      setError('');

      try {
        const response = await client.get(`/projects/${id}`);

        if (isCurrent) {
          const nextProject = response.data.project;
          setProject(nextProject);
          setEditForm({
            title: nextProject.title || '',
            description: nextProject.description || ''
          });
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Unable to load this project.');
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

  function updateField(event) {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const response = await client.put(`/projects/${id}`, editForm);
      setProject(response.data.project);
      setSuccess('Project details updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this project.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setError('');
    setIsDeleting(true);

    try {
      await client.delete(`/projects/${id}`);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this project.');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }

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
        <Button as={Link} to="/dashboard" variant="outline-accent">
          Back to dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container className="page-section">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div>
          <p className="hero-kicker mb-2">Project</p>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h1 className="fw-bold mb-0">{project.title}</h1>
            <Badge className="type-badge text-capitalize">{project.siteType || 'website'}</Badge>
            {project.modelUsed && <Badge bg="info">{project.modelUsed}</Badge>}
          </div>
          <p className="muted-copy mt-2 mb-0">{project.description || 'No description yet.'}</p>
        </div>
        <ButtonGroup className="flex-wrap">
          <Button as={Link} to="/dashboard" variant="outline-secondary">
            Dashboard
          </Button>
          <Button href={publicUrl} target="_blank" rel="noreferrer" variant="outline-accent">
            View online
          </Button>
          <Button
            variant="outline-accent"
            onClick={() => downloadHtml(project)}
            disabled={!project.generatedCode}
          >
            Download HTML
          </Button>
        </ButtonGroup>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Row className="g-4">
        <Col xl={8}>
          <Card className="app-card">
            <Card.Body className="p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="h4 fw-bold mb-1">Generated preview</h2>
                  <p className="muted-copy mb-0">Rendered inside a sandboxed iframe.</p>
                </div>
              </div>
              <SitePreview html={project.generatedCode} title={project.title} />
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="app-card mb-4">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">Edit details</h2>
              <p className="muted-copy">
                Update the project metadata. The generated HTML itself is preserved.
              </p>

              <Form onSubmit={handleSave}>
                <Form.Group className="mb-3" controlId="projectTitle">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    name="title"
                    value={editForm.title}
                    onChange={updateField}
                    minLength={2}
                    maxLength={150}
                    disabled={isSaving}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="projectDescription">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="description"
                    value={editForm.description}
                    onChange={updateField}
                    maxLength={500}
                    disabled={isSaving}
                  />
                </Form.Group>

                <Button type="submit" className="btn-accent w-100" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="app-card">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">Share URL</h2>
              <p className="muted-copy">
                Public visitors can open the generated website without logging in.
              </p>
              <Form.Control value={publicUrl} readOnly className="mb-3" />
              <Button
                variant="outline-danger"
                className="w-100"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete project
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete project?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This will permanently delete <strong>{project.title}</strong>. This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete project'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
