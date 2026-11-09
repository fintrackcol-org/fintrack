import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { roundedBox } from './shapes';

/*
 * Isotipo de Rinde en 3D, a partir del SVG del logo (viewBox 32×32): cuadro violeta de 32 con
 * radio 8, una "r" (asta en x = 9.75 y brazo de radio 5.75, trazo de 4.25) y la moneda verde.
 * Escala: 1 unidad del SVG = 0.1 unidades de la escena; el origen es el centro del cuadro.
 */
const U = 0.1;
const STEM_X = (9.75 - 16) * U;
const BASE_Y = (16 - 21.5) * U; // donde termina el asta, sin contar la punta redonda
const ARM = { x: (15.5 - 16) * U, y: (16 - 16.25) * U, r: 5.75 * U }; // centro y radio del brazo
const HALF = (4.25 / 2) * U; // medio grosor del trazo
const COIN = { x: (22 - 16) * U, y: (16 - 10.5) * U, r: 2.375 * U };
const BEVEL = 0.04;
const DEPTH = 0.34;
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

/** Extrusión con bisel suave, centrada en Z. El bisel agranda la figura: se dibuja `BEVEL` más delgada. */
function soft(shape) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -(DEPTH - BEVEL * 2) / 2);
  return geo;
}

/** Contorno de la "r": sube por el asta, dobla por el brazo y vuelve; las dos puntas son redondas. */
function rShape() {
  const h = HALF - BEVEL;
  const s = new THREE.Shape();
  s.moveTo(STEM_X - h, BASE_Y);
  s.lineTo(STEM_X - h, ARM.y);
  s.absarc(ARM.x, ARM.y, ARM.r + h, Math.PI, Math.PI / 2, true);
  s.absarc(ARM.x, ARM.y + ARM.r, h, Math.PI / 2, -Math.PI / 2, true);
  s.absarc(ARM.x, ARM.y, ARM.r - h, Math.PI / 2, Math.PI, false);
  s.lineTo(STEM_X + h, BASE_Y);
  s.absarc(STEM_X, BASE_Y, h, 0, -Math.PI, true);
  return s;
}

/**
 * Logo 3D: el cuadro violeta lacado, la "r" plateada que crece al cargar y la moneda que salta después.
 * La posición, escala y giro por scroll los aplica el padre; aquí solo vive el objeto.
 * @param {{ reducedMotion?: boolean }} props
 */
export default function LogoMark3D({ reducedMotion = false }) {
  const letter = useRef();
  const coin = useRef();
  const born = useRef(null);

  const plate = useMemo(() => roundedBox(32 * U, 32 * U, 0.7, 8 * U), []);
  const bottom = BASE_Y - HALF;
  const letterGeo = useMemo(() => {
    const g = soft(rShape());
    // Origen en la base de la letra: así "crece" desde abajo al escalar en Y.
    g.translate(0, -bottom, 0);
    return g;
  }, [bottom]);
  const coinGeo = useMemo(() => soft(new THREE.Shape().absarc(0, 0, COIN.r - BEVEL, 0, Math.PI * 2, false)), []);

  const plateMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#6142ff',
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    [],
  );
  const [letterMat, coinMat] = useMemo(
    () =>
      ['#ffffff', '#2fd6a3'].map(
        (tone) =>
          new THREE.MeshPhysicalMaterial({
            color: tone,
            metalness: 0.55,
            roughness: 0.18,
            clearcoat: 1,
            emissive: tone,
            emissiveIntensity: 0.18,
          }),
      ),
    [],
  );

  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const grow = (delay) => (reducedMotion ? 1 : Math.max(easeOutBack(Math.min(Math.max((t - delay) / 0.7, 0), 1)), 0.001));
    if (letter.current) letter.current.scale.y = grow(0.25);
    coin.current?.scale.setScalar(grow(0.7));
  });

  return (
    <group>
      <mesh geometry={plate} material={plateMat} />
      <mesh ref={letter} geometry={letterGeo} material={letterMat} position={[0, bottom, 0.42]} />
      <mesh ref={coin} geometry={coinGeo} material={coinMat} position={[COIN.x, COIN.y, 0.42]} />
    </group>
  );
}
