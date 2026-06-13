import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import client from '../api/client';
import PublicProjectCard from '../components/PublicProjectCard';
import { getPublicVisitorId } from '../utils/publicVisitor';

const SORT_OPTIONS = [
  { value: 'favorites', label: 'Most liked' },
  { value: 'recent', label: 'Created recently' },
  { value: 'random', label: 'Random discovery' }
];

export default function PublicGallery() {
  const [projects, setProjects] = useState([]);
  const [sort, setSort] = useState('favorites');
  const [isLoading, setIsLoading] = useState(true);
  const [likingProjectId, setLikingProjectId] = useState('');
  const [error, setError] = useState('');

  async function loadProjects(nextSort = sort) {
    setIsLoading(true);
    setError('');

    try {
      const response = await client.get('/public/projects', {
        params: {
          sort: nextSort,
          limit: 60,
          visitorId: getPublicVisitorId()
        }
      });

      setProjects(response.data.projects || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load public projects.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProjects(sort);
  }, [sort]);

  function updateProjectStats(nextProject) {
    setProjects((current) => current.map((project) => (
      project.id === nextProject.id
        ? { ...project, ...nextProject }
        : project
    )));
  }

  async function handleToggleLike(project) {
    setError('');
    setLikingProjectId(project.id);

    try {
      const visitorId = getPublicVisitorId();
      const response = project.isLiked
        ? await client.delete(`/public/projects/${project.id}/like`, { data: { visitorId } })
        : await client.post(`/public/projects/${project.id}/like`, { visitorId });

      updateProjectStats(response.data.project);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this like.');
    } finally {
      setLikingProjectId('');
    }
  }

  return (
    <Container className="page-section">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <p className="hero-kicker mb-2">Public gallery</p>
          <h1 className="fw-bold mb-1">Explore public SynthoSite projects</h1>
          <p className="muted-copy mb-0">Discover public websites created by the community.</p>
        </div>
        <Form.Group controlId="publicGallerySort" className="gallery-sort-control">
          <Form.Label className="fw-semibold">Sort</Form.Label>
          <Form.Select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="info" />
          <p className="muted-copy mt-3 mb-0">Loading public projects...</p>
        </div>
      ) : projects.length > 0 ? (
        <Row className="g-4">
          {projects.map((project) => (
            <Col md={6} xl={4} key={project.id} className="reveal-on-scroll">
              <PublicProjectCard
                project={project}
                onToggleLike={handleToggleLike}
                isUpdating={likingProjectId === project.id}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Alert variant="light" className="app-card border-0 p-4">
          No public projects yet.
        </Alert>
      )}

      <div className="text-center mt-5">
        <Button variant="outline-accent" onClick={() => loadProjects(sort)} disabled={isLoading}>
          Refresh gallery
        </Button>
      </div>
    </Container>
  );
}
