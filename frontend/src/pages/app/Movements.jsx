import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import MovementList from '@/components/money/MovementList';
import { Button } from '@/components/ui/button';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Página privada `/app/movimientos` (Rinde v2): todos los gastos e ingresos, con el buscador, los
 * filtros y el mes. Es una de las 4 pestañas del celular; antes vivía dentro de Mi plata.
 */
export default function Movements() {
  usePageTitle('Movimientos');
  const { names } = useCategoryNames();
  const [hidden] = useHiddenAmounts();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="¿En qué se te fue?"
        actions={
          <>
            <Button asChild variant="soft">
              <Link to="/app/transacciones/exportar">
                <Download aria-hidden="true" />
                Exportar
              </Link>
            </Button>
            <Button asChild className="max-md:hidden">
              <Link to="/app/anotar">
                <Plus aria-hidden="true" />
                Anotar
              </Link>
            </Button>
          </>
        }
      />
      <Panel className="max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none">
        <MovementList names={names} hidden={hidden} standalone />
      </Panel>
    </div>
  );
}
