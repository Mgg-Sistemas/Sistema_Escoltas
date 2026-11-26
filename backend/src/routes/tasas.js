import { Router } from 'express';
import { ok } from '../lib/http.js';

const router = Router();

let cacheTasas = {
  datos: {
    bcv_usd: 924.35,
    bcv_eur: 1011.73,
    pmp_binance: 1094.00,
    actualizado: new Date().toISOString(),
  },
  expira: 0,
};

async function obtenerTasasEnVivo() {
  const ahora = Date.now();
  if (cacheTasas.expira > ahora) {
    return cacheTasas.datos;
  }

  let bcv_usd = cacheTasas.datos.bcv_usd;
  let bcv_eur = cacheTasas.datos.bcv_eur;
  let pmp_binance = cacheTasas.datos.pmp_binance;

  // 1. Consultar BCV Dólar
  try {
    const resUsd = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(5000) });
    if (resUsd.ok) {
      const datosUsd = await resUsd.json();
      const oficial = Array.isArray(datosUsd) ? datosUsd.find((d) => d.fuente === 'oficial') : null;
      if (oficial && oficial.promedio) {
        bcv_usd = Number(oficial.promedio);
      }
    }
  } catch (err) {
    console.warn('[TASAS] Error consultando BCV Dólar:', err.message);
  }

  // 2. Consultar BCV Euro
  try {
    const resEur = await fetch('https://ve.dolarapi.com/v1/euros', { signal: AbortSignal.timeout(5000) });
    if (resEur.ok) {
      const datosEur = await resEur.json();
      const oficialEur = Array.isArray(datosEur) ? datosEur.find((d) => d.fuente === 'oficial') : null;
      if (oficialEur && oficialEur.promedio) {
        bcv_eur = Number(oficialEur.promedio);
      }
    }
  } catch (err) {
    console.warn('[TASAS] Error consultando BCV Euro:', err.message);
  }

  // 3. Consultar PMP Binance (P2P USDT/VES)
  try {
    const resBinance = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiat: 'VES',
        page: 1,
        rows: 10,
        tradeType: 'BUY',
        asset: 'USDT',
        countries: [],
        proMerchantAds: false,
        shieldMerchantAds: false,
        filterType: 'all',
        periods: [],
        additionalKycVerifyFilter: 0,
        publisherType: null,
        payTypes: [],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (resBinance.ok) {
      const jsonBinance = await resBinance.json();
      const anuncios = jsonBinance?.data || [];
      const preciosValidos = anuncios
        .map((a) => Number(a?.adv?.price))
        .filter((p) => !isNaN(p) && p > 0);

      if (preciosValidos.length > 0) {
        const suma = preciosValidos.reduce((acc, val) => acc + val, 0);
        pmp_binance = Number((suma / preciosValidos.length).toFixed(2));
      }
    }
  } catch (err) {
    console.warn('[TASAS] Error consultando Binance P2P:', err.message);
  }

  const resultado = {
    bcv_usd,
    bcv_eur,
    pmp_binance,
    actualizado: new Date().toISOString(),
  };

  cacheTasas = {
    datos: resultado,
    expira: ahora + 60_000, // 60 segundos de caché
  };

  return resultado;
}

router.get('/', async (req, res) => {
  try {
    const tasas = await obtenerTasasEnVivo();
    return ok(res, tasas);
  } catch (error) {
    return ok(res, cacheTasas.datos);
  }
});

export default router;
