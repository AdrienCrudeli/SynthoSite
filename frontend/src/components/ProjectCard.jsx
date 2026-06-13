import { Badge, Button, Card, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function ProjectCard({ project, onToggleVisibility, isToggling = false }) {
  return (
    <Card className="app-card project-card h-100">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div className="d-flex flex-wrap gap-2">
            <Badge className="type-badge text-capitalize">{project.siteType || 'website'}</Badge>
            {project.modelUsed && <Badge bg="info">{project.modelUsed}</Badge>}
            <Badge bg={project.isPublic ? 'success' : 'secondary'}>
              {project.isPublic ? 'Public' : 'Private'}
            </Badge>
          </div>
          <span className="small muted-copy">{formatDate(project.updatedAt || project.createdAt)}</span>
        </div>
        <Card.Title className="fw-bold">{project.title}</Card.Title>
        <Card.Text className="muted-copy flex-grow-1">
          {project.description || 'No description yet.'}
        </Card.Text>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
          <Form.Check
            type="switch"
            id={`project-public-${project.id}`}
            label={project.isPublic ? 'Public' : 'Private'}
            checked={Boolean(project.isPublic)}
            disabled={isToggling}
            onChange={(event) => onToggleVisibility?.(project, event.target.checked)}
          />
          <Button as={Link} to={`/projects/${project.id}`} variant="outline-accent" size="sm">
            View project
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
