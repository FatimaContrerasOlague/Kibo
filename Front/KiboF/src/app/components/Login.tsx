import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Moon, Sun } from 'lucide-react';
import { ElephantMascot } from './ElephantMascot';
import { useTheme } from '../contexts/ThemeContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (await login(email, password)) {
      navigate('/home');
    } else {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-2xl p-8 border border-border">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex justify-center mb-4">
            <ElephantMascot size="large" />
          </div>

          <h1 className="text-center text-foreground mb-2">Bienvenido a Kibo</h1>
          <p className="text-center text-muted-foreground mb-8">
            Tu gestor de tareas inteligente
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block mb-2 text-foreground">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-input-background text-foreground placeholder:text-muted-foreground rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2 text-foreground">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-input-background text-foreground placeholder:text-muted-foreground rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary to-accent text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
            >
              <LogIn className="w-5 h-5" />
              {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-primary hover:underline"
              >
                Regístrate aquí
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
