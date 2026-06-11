import { createContext, useContext, useState } from 'react';
import { AUTH_STORAGE_KEY } from '../api/client';

const AuthContext = createContext(null);

function getInitialAuth() {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedAuth) {
    return { token: null, user: null };
  }

  try {
    const parsedAuth = JSON.parse(storedAuth);
    return {
      token: parsedAuth.token || null,
      user: parsedAuth.user || null
    };
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getInitialAuth);

  function login(token, user) {
    const nextAuth = { token, user };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    setAuth(nextAuth);
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth({ token: null, user: null });
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth.token,
        user: auth.user,
        isAuthenticated: Boolean(auth.token),
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
