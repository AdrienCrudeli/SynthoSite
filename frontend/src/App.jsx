import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import FooterBanner from './components/FooterBanner';
import ScrollReveal from './components/ScrollReveal';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Generate from './pages/Generate';
import ProjectView from './pages/ProjectView';
import Admin from './pages/Admin';
import AdminProjectView from './pages/AdminProjectView';
import About from './pages/About';
import PublicGallery from './pages/PublicGallery';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('synthosite_theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('synthosite_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        <ScrollReveal />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/about" element={<About />} />
          <Route path="/gallery" element={<PublicGallery />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <Generate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={
              <AdminRoute>
                <AdminProjectView />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <FooterBanner />
      </div>
    </BrowserRouter>
  );
}
