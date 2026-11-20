import { Link } from 'react-router-dom';
import { ArrowUp, Play } from 'lucide-react';
import Logo, { Wordmark } from '@/components/common/Logo';
import { useTour } from '@/components/home/tour/GuidedTour';
import useApiHealth from '@/hooks/useApiHealth';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const COLUMNS = [
  {
    title: t('Producto'),
    links: [
      { href: '#funcionalidades', label: t('Funcionalidades') },
      { href: '#alertas', label: t('Alertas') },
      { href: '#app', label: t('App instalable') },
      { href: '#seguridad', label: t('Seguridad') },
    ],
  },
  {
    title: t('Recursos'),
    links: [
      { href: '#como-funciona', label: t('Cómo funciona') },
      { href: '#faq', label: t('Preguntas frecuentes') },
      { tour: true, label: t('Escuchar el recorrido') },
    ],
  },
  {
    title: t('Legal'),
    links: [
      { to: '/terminos', label: t('Términos de uso') },
      { to: '/privacidad', label: t('Política de privacidad') },
    ],
  },
  {
    title: t('Cuenta'),
    links: [
      { to: '/login', label: t('Iniciar sesión') },
      { to: '/registro', label: t('Crear cuenta') },
    ],
  },
];

const STATUS_LABEL = { loading: t('Verificando API…'), ok: t('API operativa'), error: t('API sin conexión') };
const STATUS_DOT = { loading: 'bg-white/40 animate-pulse', ok: 'bg-success', error: 'bg-destructive' };

/** Enlace del pie: gris que se pone blanco y se corre un poco a la derecha. */
const LINK = 'inline-flex items-center gap-2 text-white/65 transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-white';

/**
 * Pie de página: marca y tres columnas de enlaces, la línea final con el estado de `GET /health`
 * y "Volver arriba", y el nombre Rinde en violeta cortado por el borde inferior como cierre.
 */
export default function Footer() {
  const apiStatus = useApiHealth();
  const tour = useTour();

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="relative overflow-hidden bg-black pt-16 text-white">
      <div className="container-page relative grid grid-cols-2 gap-x-6 gap-y-12 py-16 md:grid-cols-[1.5fr_repeat(4,1fr)] md:py-20">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Logo />
          <p className="mt-4 text-white/65">
            {t('Registra tus gastos, controla tu presupuesto y sincroniza tus datos, incluso sin conexión.')}
          </p>
          {/* /60 y no /40: sobre negro, /40 daba contraste 3,65:1 (WCAG pide 4,5:1 para texto de 14 px). */}
          <p className="mt-6 text-sm text-white/60">{t('Proyecto académico · Universidad Surcolombiana')}</p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-5 text-sm font-medium text-orchid">{col.title}</h3>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.to && (
                    <Link to={link.to} className={LINK}>
                      {link.label}
                    </Link>
                  )}
                  {link.href && (
                    <a href={link.href} className={LINK}>
                      {link.label}
                    </a>
                  )}
                  {link.tour && (
                    <button type="button" onClick={tour.start} className={cn(LINK, 'text-left')}>
                      <span className="grid size-5 place-items-center rounded-full bg-violet text-white">
                        <Play className="size-2.5 translate-x-px" aria-hidden="true" />
                      </span>
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-page relative flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {t('Rinde')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5" role="status">
            <span className={cn('size-2 rounded-full', STATUS_DOT[apiStatus])} />
            {STATUS_LABEL[apiStatus]}
          </p>
          <button
            type="button"
            onClick={toTop}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            {t('Volver arriba')}
            <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        Cierre: el nombre de la marca a todo el ancho, en violeta y cortado por el borde inferior.
        Es decorativo.
      */}
      <div aria-hidden="true" className="container-page relative mt-4 h-[17.5vw] max-h-56 select-none overflow-hidden">
        <Wordmark className="h-auto w-full text-[#7a5cff] opacity-70" />
      </div>
    </footer>
  );
}
