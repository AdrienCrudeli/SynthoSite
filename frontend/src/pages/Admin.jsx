import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const stats = useMemo(() => ({
    users: users.length,
    admins: users.filter((item) => item.role === 'admin').length,
    projects: projects.length
  }), [projects.length, users]);

  async function loadAdminData() {
    setIsLoading(true);
    setError('');

    try {
      const [usersResponse, projectsResponse] = await Promise.all([
        client.get('/admin/users'),
        client.get('/admin/projects')
      ]);

      setUsers(usersResponse.data.users || []);
      setProjects(projectsResponse.data.projects || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  function openDeleteModal(type, item) {
    setSuccess('');
    setError('');
    setDeleteTarget({ type, item });
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      if (deleteTarget.type === 'user') {
        await client.delete(`/admin/users/${deleteTarget.item.id}`);
        setUsers((current) => current.filter((item) => item.id !== deleteTarget.item.id));
        setProjects((current) => current.filter((item) => item.userId !== deleteTarget.item.id));
        setSuccess(`User "${deleteTarget.item.username}" deleted.`);
      } else {
        await client.delete(`/admin/projects/${deleteTarget.item.id}`);
        setProjects((current) => current.filter((item) => item.id !== deleteTarget.item.id));
        setSuccess(`Project "${deleteTarget.item.title}" deleted.`);
      }

      setDeleteTarget(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Delete failed.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Container className="page-section">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div>
          <p className="hero-kicker mb-2">Administration</p>
          <h1 className="fw-bold mb-1">Admin control center</h1>
          <p className="muted-copy mb-0">
            Manage registered users and generated projects from one protected section.
          </p>
        </div>
        <Button variant="outline-accent" onClick={loadAdminData} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Row className="g-4 mb-4">
        <Col md={4}>
          <Card className="app-card admin-stat-card">
            <Card.Body>
              <p className="muted-copy mb-1">Users</p>
              <strong>{stats.users}</strong>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="app-card admin-stat-card">
            <Card.Body>
              <p className="muted-copy mb-1">Admins</p>
              <strong>{stats.admins}</strong>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="app-card admin-stat-card">
            <Card.Body>
              <p className="muted-copy mb-1">Projects</p>
              <strong>{stats.projects}</strong>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="info" />
          <p className="muted-copy mt-3 mb-0">Loading admin data...</p>
        </div>
      ) : (
        <Row className="g-4">
          <Col xl={5}>
            <Card className="app-card">
              <Card.Body className="p-4">
                <h2 className="h4 fw-bold mb-3">Users</h2>
                <Table responsive hover className="align-middle admin-table mb-0">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Projects</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.username}</strong>
                          <span>{item.email}</span>
                          <small>Joined {formatDate(item.createdAt)}</small>
                        </td>
                        <td>
                          <Badge bg={item.role === 'admin' ? 'dark' : 'secondary'}>
                            {item.role}
                          </Badge>
                        </td>
                        <td>{item.projectCount}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => openDeleteModal('user', item)}
                            disabled={item.id === user?.id}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center muted-copy py-4">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={7}>
            <Card className="app-card">
              <Card.Body className="p-4">
                <h2 className="h4 fw-bold mb-3">Projects</h2>
                <Table responsive hover className="align-middle admin-table mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Owner</th>
                      <th>Type</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <span>{item.description || 'No description'}</span>
                          <small>Updated {formatDate(item.updatedAt || item.createdAt)}</small>
                        </td>
                        <td>
                          <strong>{item.ownerUsername}</strong>
                          <span>{item.ownerEmail}</span>
                        </td>
                        <td>
                          <Badge className="type-badge text-capitalize">
                            {item.siteType || 'website'}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => openDeleteModal('project', item)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center muted-copy py-4">
                          No projects found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Modal show={Boolean(deleteTarget)} onHide={() => setDeleteTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Delete {deleteTarget?.type === 'user' ? 'user' : 'project'}?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteTarget?.type === 'user' ? (
            <p className="mb-0">
              This will delete <strong>{deleteTarget.item.username}</strong> and all projects that
              belong to this user.
            </p>
          ) : (
            <p className="mb-0">
              This will delete <strong>{deleteTarget?.item.title}</strong>. The public page will no
              longer be available.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
