import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { CheckCircle2, Database, Sparkles, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client, { getModels, getUsage } from '../api/client';
import UsageMeter from '../components/UsageMeter';

const SITE_TYPES = [
  { value: 'business', label: 'Business' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'blog', label: 'Blog' },
  { value: 'restaurant', label: 'Restaurant' }
];

const SURPRISE_PROMPTS = [
  {
    title: 'Moonlight Taco Lab',
    description:
      'A playful restaurant website for a late-night taco bar with a neon menu, chef story, spicy specials and customer quotes.',
    siteType: 'restaurant',
    primaryColor: '#F97316',
    mood: 'bold, neon, fun and cinematic'
  },
  {
    title: 'Retro Rocket Barber',
    description:
      'A polished business site for a vintage space-themed barber shop with services, booking call-to-action and a gallery.',
    siteType: 'business',
    primaryColor: '#2563EB',
    mood: 'retro-futuristic, confident and clean'
  },
  {
    title: 'Tiny Desk Jungle',
    description:
      'A portfolio for a plant-loving illustrator, with lush artwork sections, commissions, process notes and contact details.',
    siteType: 'portfolio',
    primaryColor: '#16A34A',
    mood: 'organic, creative and bright'
  },
  {
    title: 'Cafe Quantum',
    description:
      'A blog about science, coffee and curious experiments, with featured posts, newsletter signup and a warm editorial feel.',
    siteType: 'blog',
    primaryColor: '#8B5CF6',
    mood: 'smart, cozy and imaginative'
  }
];

export default function Generate() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    siteType: 'business',
    model: '',
    isPublic: false,
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

  async function generateWebsite(nextFormData) {
    setError('');
    setIsGenerating(true);

    try {
      const response = await client.post('/projects/generate', {
        title: nextFormData.title,
        description: nextFormData.description,
        siteType: nextFormData.siteType,
        model: nextFormData.model,
        isPublic: nextFormData.isPublic,
        styleOptions: {
          primaryColor: nextFormData.primaryColor,
          mood: nextFormData.mood,
          title: nextFormData.title
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

  async function handleSubmit(event) {
    event.preventDefault();
    await generateWebsite(formData);
  }

  async function handleSurprise() {
    const surprise = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    const nextFormData = {
      ...formData,
      ...surprise,
      model: formData.model
    };

    setFormData(nextFormData);
    await generateWebsite(nextFormData);
  }

  return (
    <Container className="page-section">
      <Row className="g-4 align-items-start">
        <Col lg={7} className="reveal-on-scroll">
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

                <Form.Check
                  className="mb-3"
                  type="switch"
                  id="generateIsPublic"
                  name="isPublic"
                  label="Publish this site immediately"
                  checked={formData.isPublic}
                  onChange={(event) => setFormData((current) => ({
                    ...current,
                    isPublic: event.target.checked
                  }))}
                  disabled={isGenerating}
                />

                <div className="d-grid gap-2 mt-2">
                  <Button
                    type="submit"
                    className="btn-accent"
                    disabled={isGenerating || isLoadingModels || !formData.model}
                  >
                    {isGenerating ? (
                      <>
                        <WandSparkles size={16} className="me-2" />
                        Generation in progress...
                      </>
                    ) : (
                      'Generate website'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-accent"
                    onClick={handleSurprise}
                    disabled={isGenerating || isLoadingModels || !formData.model}
                  >
                    Surprise me
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5} className="reveal-on-scroll">
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
              {isGenerating && (
                <div className="generation-flow mt-4" aria-live="polite">
                  {[
                    ['Analyze', Sparkles],
                    ['Generate', WandSparkles],
                    ['Save', Database],
                    ['Ready', CheckCircle2]
                  ].map(([label, Icon], index) => (
                    <div className="generation-flow-step" style={{ animationDelay: `${index * 220}ms` }} key={label}>
                      <Icon size={18} strokeWidth={2.2} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
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
