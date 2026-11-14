import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';
import { useAuth } from '@/auth/AuthContext';
import { getReturnTo } from '@/auth/returnTo';
import { credentialNonce, takeGoogleNonce } from '@/lib/google';

/**
 * Vuelta de "Continuar con Google" en la app instalada (`/entrar/google#credential=…`). El backend
 * recibe el formulario de Google y redirige aquí con el token después de "#". Antes de usarlo se
 * compara su `nonce` con el que guardó este dispositivo al empezar; luego se entra como en el login.
 */
export default function GoogleReturn() {
  usePageTitle('Entrar con Google');
  const location = useLocation();
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  // Se lee una sola vez, antes de limpiar la dirección.
  const [credential] = useState(() => new URLSearchParams(location.hash.slice(1)).get('credential'));
  const [error, setError] = useState('');
  // Como en VerifyEmail: en desarrollo React corre los efectos dos veces y el nonce sirve una vez.
  const started = useRef(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const expected = takeGoogleNonce();
    if (!credential) {
      setError('Google no nos devolvió tu cuenta. Inténtalo de nuevo.');
      return;
    }
    if (!expected || credentialNonce(credential) !== expected) {
      setError('Este inicio con Google no se empezó en este dispositivo. Vuelve a tocar «Continuar con Google».');
      return;
    }
    signInWithGoogle(credential)
      .then(() => navigate(getReturnTo(), { replace: true }))
      .catch((err) => setError(err.message || 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.'));
  }, [credential, navigate, signInWithGoogle]);

  if (error) {
    return (
      <AuthLayout icon={ShieldAlert} title="No pudimos entrar con Google" subtitle={error}>
        <Button asChild size="lg" className="w-full">
          <Link to="/login" replace>
            Volver a iniciar sesión
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={LogIn} title="Entrando con Google" subtitle="Un momento, ya casi entras.">
      <p className="flex justify-center" role="status" aria-label="Entrando con Google">
        <Loader2 className="size-6 animate-spin text-violet-light" aria-hidden="true" />
      </p>
    </AuthLayout>
  );
}
