import { Link } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';
import { t } from '@/lib/i18n';

/** Página 404 para rutas desconocidas del frontend. */
export default function NotFound() {
  usePageTitle(t('Página no encontrada'));
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black p-4 text-center text-white">
      <Logo />
      <p className="text-8xl font-semibold tracking-tight text-violet-light">404</p>
      <p className="text-white/60">{t('La página que buscas no existe o fue movida.')}</p>
      <Button asChild size="lg">
        <Link to="/">{t('Volver al inicio')}</Link>
      </Button>
    </main>
  );
}
