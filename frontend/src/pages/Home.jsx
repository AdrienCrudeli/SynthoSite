import { Badge, Button, Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section className="hero-section py-5">
        <Container className="py-5">
          <Row className="align-items-center g-5">
            <Col lg={7}>
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
            <Col lg={5}>
              <Card className="app-card">
                <Card.Body className="p-4">
                  <Badge className="type-badge mb-3">Example prompt</Badge>
                  <h2 className="h4 fw-bold">Modern restaurant landing page</h2>
                  <p className="muted-copy">
                    A warm, mobile-first website for a coastal restaurant with teal highlights,
                    a hero section, menu preview, testimonials and a footer.
                  </p>
                  <div className="border rounded-4 p-3 bg-light">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="brand-mark">S</span>
                      <strong>Generated website</strong>
                    </div>
                    <div className="rounded-4 p-4 text-white" style={{ background: '#0B1F3A' }}>
                      <p className="small text-info mb-2">Fresh from the AI</p>
                      <h3 className="h5 fw-bold">Sea Salt Bistro</h3>
                      <p className="small text-white-50 mb-0">
                        Responsive HTML, saved in MySQL and served through a public URL.
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="page-section">
        <Row className="g-4">
          {[
            ['Secure accounts', 'JWT authentication, bcrypt password hashing and protected project routes.'],
            ['Project workspace', 'Search, sort and filter your generated websites from a clean dashboard.'],
            ['Public sharing', 'Each generated page can be served as HTML through a public share URL.']
          ].map(([title, copy]) => (
            <Col md={4} key={title}>
              <Card className="app-card h-100">
                <Card.Body className="p-4">
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
