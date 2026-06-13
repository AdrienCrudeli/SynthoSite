import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { FolderPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import ProjectCard from '../components/ProjectCard';
import UsageMeter from '../components/UsageMeter';

const SITE_TYPES = [
  { value: '', label: 'All types' },
  { value: 'business', label: 'Business' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'blog', label: 'Blog' },
  { value: 'restaurant', label: 'Restaurant' }
];

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [togglingProjectId, setTogglingProjectId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function fetchProjects() {
      setIsLoading(true);
      setError('');

      try {
        const response = await client.get('/projects', {
          params: {
            search,
            sort,
            type
          }
        });

        if (isCurrent) {
          setProjects(response.data.projects || []);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Unable to load projects.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(fetchProjects, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [search, sort, type]);

  async function handleToggleVisibility(project, isPublic) {
    setError('');
    setTogglingProjectId(project.id);

    try {
      const response = await client.patch(`/projects/${project.id}/visibility`, { isPublic });
      const nextProject = response.data.project;

      setProjects((current) => current.map((item) => (
        item.id === nextProject.id ? { ...item, ...nextProject } : item
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update project visibility.');
    } finally {
      setTogglingProjectId('');
    }
  }

  return (
    <Container className="page-section">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4 reveal-on-scroll">
        <div>
          <p className="hero-kicker mb-2">Workspace</p>
          <h1 className="fw-bold mb-1">Your generated websites</h1>
          <p className="muted-copy mb-0">Search, sort and manage the projects saved in your account.</p>
        </div>
        <Button as={Link} to="/generate" className="btn-accent">
          Generate a site
        </Button>
      </div>

      <div className="dashboard-toolbar p-3 p-md-4 mb-4 reveal-on-scroll">
        <Row className="g-3">
          <Col lg={6}>
            <Form.Label className="fw-semibold">Search</Form.Label>
            <Form.Control
              type="search"
              placeholder="Search by title or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col md={6} lg={3}>
            <Form.Label className="fw-semibold">Sort</Form.Label>
            <Form.Select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A-Z</option>
            </Form.Select>
          </Col>
          <Col md={6} lg={3}>
            <Form.Label className="fw-semibold">Type</Form.Label>
            <Form.Select value={type} onChange={(event) => setType(event.target.value)}>
              {SITE_TYPES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="mb-4 reveal-on-scroll">
        <UsageMeter />
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="info" />
          <p className="muted-copy mt-3 mb-0">Loading projects...</p>
        </div>
      ) : projects.length > 0 ? (
        <Row className="g-4">
          {projects.map((project) => (
            <Col md={6} xl={4} key={project.id} className="reveal-on-scroll">
              <ProjectCard
                project={project}
                onToggleVisibility={handleToggleVisibility}
                isToggling={togglingProjectId === project.id}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Alert variant="light" className="app-card empty-state border-0 p-4 reveal-on-scroll">
          <div className="empty-state-icon" aria-hidden="true">
            <FolderPlus size={34} strokeWidth={2} />
          </div>
          <h2 className="h5 fw-bold">No projects found</h2>
          <p className="muted-copy mb-3">
            Adjust your filters or generate your first website from a prompt.
          </p>
          <Button as={Link} to="/generate" className="btn-accent">
            Create first project
          </Button>
        </Alert>
      )}
    </Container>
  );
}
