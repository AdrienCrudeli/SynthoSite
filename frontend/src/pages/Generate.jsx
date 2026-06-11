import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import client, { getModels, getUsage } from '../api/client';
import UsageMeter from '../components/UsageMeter';

const SITE_TYPES = [
  { value: 'business', label: 'Business' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'blog', label: 'Blog' },
  { value: 'restaurant', label: 'Restaurant' }
];

export default function Generate() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    siteType: 'business',
    model: '',
    primaryColor: '#14B8A6',
    mood: 'modern, trustworthy and polished'
  });
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isCurrent = true;

    async function loadModels() {
      setError('');
      setIsLoadingModels(true);

      try {
        const nextModels = await getModels();

        if (isCurrent) {
          setModels(nextModels || []);
          setFormData((current) => ({
            ...current,
            model: current.model || nextModels?.[0]?.id || ''
          }));
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Unable to load AI models.');
        }
      } finally {
        if (isCurrent) {
          setIsLoadingModels(false);
        }
      }
    }

    loadModels();

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateField(event) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsGenerating(true);

    try {
      const response = await client.post('/projects/generate', {
        title: formData.title,
        description: formData.description,
        siteType: formData.siteType,
        model: formData.model,
        styleOptions: {
          primaryColor: formData.primaryColor,
          mood: formData.mood,
          title: formData.title
        }
      });

      await getUsage();
      setUsageRefreshKey((current) => current + 1);
      navigate(`/projects/${response.data.project.id}`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Website generation failed. Please try again in a moment.'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Container className="page-section">
      <Row className="g-4 align-items-start">
        <Col lg={7}>
          <Card className="app-card">
            <Card.Body className="p-4 p-md-5">
              <p className="hero-kicker mb-2">AI builder</p>
              <h1 className="fw-bold mb-2">Generate a new website</h1>
              <p className="muted-copy mb-4">
                Describe the site you want. SynthoSite will ask the AI for one complete HTML file,
                save it in your account and open the preview when it is ready.
              </p>

              {error && <Alert variant="danger">{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="generateTitle">
                  <Form.Label>Website title</Form.Label>
                  <Form.Control
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={updateField}
                    minLength={2}
                    maxLength={150}
                    placeholder="Example: Sea Salt Bistro"
                    disabled={isGenerating}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="generateDescription">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    name="description"
                    value={formData.description}
                    onChange={updateField}
                    maxLength={500}
                    placeholder="Describe the business, audience, sections and tone you want."
                    disabled={isGenerating}
                  />
                  <Form.Text className="muted-copy">
                    {formData.description.length}/500 characters
                  </Form.Text>
                </Form.Group>

                <Row className="g-3">
                  <Col md={4}>
                    <Form.Group controlId="generateSiteType">
                      <Form.Label>Website type</Form.Label>
                      <Form.Select
                        name="siteType"
                        value={formData.siteType}
                        onChange={updateField}
                        disabled={isGenerating}
                      >
                        {SITE_TYPES.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group controlId="generateModel">
                      <Form.Label>AI model</Form.Label>
                      <Form.Select
                        name="model"
                        value={formData.model}
                        onChange={updateField}
                        disabled={isGenerating || isLoadingModels}
                        required
                      >
                        {models.map((model) => (
                          <option value={model.id} key={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group controlId="generatePrimaryColor">
                      <Form.Label>Primary color</Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Control
                          name="primaryColor"
                          type="color"
                          value={formData.primaryColor}
                          onChange={updateField}
                          disabled={isGenerating}
                          title="Choose the primary color"
                        />
                        <Form.Control
                          name="primaryColor"
                          type="text"
                          value={formData.primaryColor}
                          onChange={updateField}
                          disabled={isGenerating}
                          pattern="^#[0-9A-Fa-f]{6}$"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="my-3" controlId="generateMood">
                  <Form.Label>Theme or mood</Form.Label>
                  <Form.Control
                    name="mood"
                    type="text"
                    value={formData.mood}
                    onChange={updateField}
                    maxLength={120}
                    placeholder="Example: elegant, playful, premium, minimalist"
                    disabled={isGenerating}
                  />
                </Form.Group>

                <Button
                  type="submit"
                  className="btn-accent w-100 mt-2"
                  disabled={isGenerating || isLoadingModels || !formData.model}
                >
                  {isGenerating ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Generation in progress...
                    </>
                  ) : (
                    'Generate website'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="app-card sticky-lg-top generate-help-card">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold">What happens next?</h2>
              <p className="muted-copy">
                The generation call can take 10 to 60 seconds. Keep this tab open while the AI
                creates the HTML file.
              </p>
              <div className="generation-note">
                <strong>Security note</strong>
                <p className="mb-0">
                  Generated HTML is treated as untrusted content and previewed only inside a
                  sandboxed iframe.
                </p>
              </div>
            </Card.Body>
          </Card>

          <div className="mt-4">
            <UsageMeter refreshKey={usageRefreshKey} />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
