import { Badge, Button, Card } from 'react-bootstrap';
import { ExternalLink, Eye, Heart } from 'lucide-react';
import { API_PUBLIC_ORIGIN } from '../api/client';

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export default function PublicProjectCard({ project, onToggleLike, isUpdating = false }) {
  const publicUrl = `${API_PUBLIC_ORIGIN}/p/${project.id}`;

  return (
    <Card className="app-card public-project-card h-100">
      <Card.Body className="d-flex flex-column p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div className="d-flex flex-wrap gap-2">
            <Badge className="type-badge text-capitalize">{project.siteType || 'website'}</Badge>
            <Badge bg="success">Public</Badge>
          </div>
          <span className="small muted-copy">{formatDate(project.createdAt)}</span>
        </div>

        <Card.Title className="fw-bold">{project.title}</Card.Title>
        <Card.Text className="muted-copy flex-grow-1">
          {project.description || 'No description yet.'}
        </Card.Text>

        <div className="public-project-owner mb-3">
          Created by <strong>{project.ownerUsername || 'SynthoSite user'}</strong>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 public-project-stats">
          <span>
            <Heart size={16} fill={project.isLiked ? 'currentColor' : 'none'} />
            {project.likeCount}
          </span>
          <span>
            <Eye size={16} />
            {project.viewCount}
          </span>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-auto">
          <Button
            type="button"
            variant={project.isLiked ? 'accent' : 'outline-accent'}
            size="sm"
            onClick={() => onToggleLike(project)}
            disabled={isUpdating}
          >
            <Heart size={15} fill={project.isLiked ? 'currentColor' : 'none'} className="me-1" />
            {project.isLiked ? 'Liked' : 'Like'}
          </Button>
          <Button href={publicUrl} target="_blank" rel="noreferrer" variant="outline-secondary" size="sm">
            <ExternalLink size={15} className="me-1" />
            Open
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
