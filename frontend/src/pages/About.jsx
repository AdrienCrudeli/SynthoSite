import { Card, Col, Container, Row } from 'react-bootstrap';

export default function About() {
  return (
    <Container className="page-section about-page">
      <Row className="justify-content-center mb-4 reveal-on-scroll">
        <Col lg={9}>
          <p className="hero-kicker mb-2">About us</p>
          <h1 className="fw-bold mb-3">About SynthoSite</h1>
          <p className="lead muted-copy mb-0">
            An application built to turn a website idea into a shareable web experience.
          </p>
        </Col>
      </Row>

      <Row className="g-4 justify-content-center">
        <Col lg={9} className="reveal-on-scroll">
          <section className="about-story">
            <h2 className="h4 fw-bold mb-3">Our story</h2>
            <p className="mb-0">
              SynthoSite was born from a simple observation: too many good ideas never see the
              light of day because creating a website takes time, skills and patience. What if
              describing an idea in a few sentences was enough to bring it to life in seconds?
              That is SynthoSite's bet: putting the power of artificial intelligence in service of
              creativity, so anyone - entrepreneur, artist, student or simple dreamer - can bring a
              web project to life without writing a single line of code.
            </p>
          </section>
        </Col>

        <Col lg={9} className="reveal-on-scroll">
          <Card className="app-card creator-card">
            <Card.Body className="p-4 p-md-5">
              <Row className="g-4 align-items-center">
                <Col md="auto">
                  <img
                    src="/images/AboutUs_Picture.jpeg"
                    alt="Adrien Crudeli"
                    className="creator-photo"
                  />
                </Col>
                <Col>
                  <p className="hero-kicker mb-2">The creator</p>
                  <h2 className="h4 fw-bold mb-3">Adrien Crudeli</h2>
                  <p className="mb-0">
                    Behind SynthoSite is Adrien Crudeli, a 22-year-old independent developer as
                    curious as he is passionate. For him, coding is not only a profession: it is a
                    playground. Always looking for the next idea to explore, he loves building
                    things that blend technique and enjoyment - and SynthoSite is the perfect
                    example: a serious project built while having fun.
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
