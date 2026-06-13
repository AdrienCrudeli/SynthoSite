import { Button, Container, Nav, Navbar as BootstrapNavbar } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ theme, onToggleTheme }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <BootstrapNavbar expand="lg" variant="dark" className="app-navbar" sticky="top">
      <Container>
        <BootstrapNavbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-bold">
          <img
            src="/images/Logo_SyntheSite_HeadBAr.svg"
            alt="SynthoSite"
            className="brand-logo"
          />
        </BootstrapNavbar.Brand>
        <BootstrapNavbar.Toggle aria-controls="main-navbar" />
        <BootstrapNavbar.Collapse id="main-navbar">
          <Nav className="ms-auto align-items-lg-center gap-lg-2">
            <Nav.Link as={NavLink} to="/about">
              About
            </Nav.Link>
            {isAuthenticated ? (
              <>
                <Nav.Link as={NavLink} to="/dashboard">
                  Dashboard
                </Nav.Link>
                <Nav.Link as={NavLink} to="/generate">
                  Generate
                </Nav.Link>
                {user?.role === 'admin' && (
                  <Nav.Link as={NavLink} to="/admin">
                    Admin
                  </Nav.Link>
                )}
                <span className="text-white-50 small px-lg-2">{user?.username}</span>
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <Button size="sm" variant="outline-light" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/login">
                  Login
                </Nav.Link>
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <Button as={Link} to="/signup" size="sm" className="btn-accent">
                  Create account
                </Button>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
}
