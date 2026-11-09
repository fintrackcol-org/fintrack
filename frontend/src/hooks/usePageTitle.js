import { useEffect } from 'react';

/**
 * Define el `<title>` del documento mientras la página está montada.
 * @param {string} title Título de la página; se le agrega " | Rinde".
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Rinde` : 'Rinde';
  }, [title]);
}
