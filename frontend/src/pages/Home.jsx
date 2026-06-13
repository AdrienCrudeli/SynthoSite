import { Badge, Button, Card, Col, Container, Row } from 'react-bootstrap';
import { FolderKanban, Link2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    title: 'Secure accounts',
    copy: 'JWT authentication, bcrypt password hashing and protected project routes.',
    icon: ShieldCheck
  },
  {
    title: 'Project workspace',
    copy: 'Search, sort and filter your generated websites from a clean dashboard.',
    icon: FolderKanban
  },
  {
    title: 'Public sharing',
    copy: 'Each generated page can be served as HTML through a public share URL.',
    icon: Link2
  }
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section className="hero-section py-5">
        <div className="hero-grid-overlay" aria-hidden="true" />
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <Container className="py-5">
          <Row className="align-items-center g-5">
            <Col lg={7} className="hero-copy reveal-on-scroll">
              <p className="hero-kicker mb-3">AI website generator</p>
              <h1 className="display-4 fw-bold mb-4">
                Describe a website. SynthoSite turns it into a shareable page.
              </h1>
              <p className="lead text-white-50 mb-4">
                Create business pages, portfolios, blogs and restaurant websites from a simple prompt.
                Your generated HTML is saved, previewed and ready to share.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Button as={Link} to={isAuthenticated ? '/generate' : '/signup'} size="lg" className="btn-accent">
                  Start generating
                </Button>
                <Button as={Link} to={isAuthenticated ? '/dashboard' : '/login'} size="lg" variant="outline-light">
                  {isAuthenticated ? 'Open dashboard' : 'Login'}
                </Button>
              </div>
            </Col>
            <Col lg={5} className="reveal-on-scroll">
              <Card className="app-card hero-demo-card">
                <Card.Body className="p-4">
                  <Badge className="type-badge mb-3 generating-badge">Generating...</Badge>
                  <h2 className="h4 fw-bold">Modern restaurant landing page</h2>
                  <p className="muted-copy">
                    A warm, mobile-first website for a coastal restaurant with teal highlights,
                    a hero section, menu preview, testimonials and a footer.
                  </p>
                  <div className="hero-browser-preview">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="brand-mark">S</span>
                      <strong>Generated website</strong>
                    </div>
                    <div className="hero-mini-site">
                      <p className="small text-info mb-2 typing-line">Fresh from the AI</p>
                      <h3 className="h5 fw-bold">Sea Salt Bistro</h3>
                      <p className="small text-white-50 mb-0">
                        Responsive HTML, saved in MySQL and served through a public URL.
                      </p>
                      <div className="generation-steps" aria-hidden="true">
                        <span>Analyze</span>
                        <span>Generate</span>
                        <span>Save</span>
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="page-section geometric-section">
        <Row className="g-4">
          {FEATURES.map(({ title, copy, icon: Icon }) => (
            <Col md={4} key={title} className="reveal-on-scroll">
              <Card className="app-card feature-card h-100">
                <Card.Body className="p-4">
                  <div className="feature-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={2.1} />
                  </div>
                  <h2 className="h5 fw-bold">{title}</h2>
                  <p className="muted-copy mb-0">{copy}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}
