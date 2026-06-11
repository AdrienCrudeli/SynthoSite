import { useState } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Signup() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  function updateField(event) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await client.post('/auth/signup', formData);
      navigate('/login', {
        state: {
          message: 'Account created. You can now login.'
        }
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container>
      <Card className="app-card auth-card">
        <Card.Body className="p-4 p-md-5">
          <p className="hero-kicker mb-2">Join SynthoSite</p>
          <h1 className="h3 fw-bold mb-4">Create your account</h1>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="signupUsername">
              <Form.Label>Username</Form.Label>
              <Form.Control
                name="username"
                type="text"
                autoComplete="username"
                value={formData.username}
                onChange={updateField}
                minLength={3}
                maxLength={50}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="signupEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={updateField}
                required
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="signupPassword">
              <Form.Label>Password</Form.Label>
              <Form.Control
                name="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={updateField}
                minLength={8}
                required
              />
              <Form.Text className="muted-copy">Use at least 8 characters.</Form.Text>
            </Form.Group>

            <Button type="submit" className="btn-accent w-100" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </Form>

          <p className="muted-copy text-center mt-4 mb-0">
            Already registered? <Link to="/login">Login</Link>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
