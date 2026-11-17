/**
 * Aviso flotante cuando algo no se pudo traer (lienzo «Sin conexión»): qué falló, que se reintenta solo
 * al volver la conexión y un botón para reintentar ya. Va encima de la barra de pestañas en el celular.
 * @param {{ message: string, onRetry: () => void }} props
 */
export default function LoadErrorToast({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),12px)+148px)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-surface p-3.5 pl-4 shadow-elevated ring-1 ring-negative/60 md:bottom-24 md:right-8 md:left-auto md:mx-0"
    >
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-negative" />
      <p className="min-w-0 flex-1 text-sm">
        <b className="font-semibold text-negative">{message}</b> Lo intentamos solos cuando vuelva la conexión.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-violet"
      >
        Reintentar
      </button>
    </div>
  );
}
