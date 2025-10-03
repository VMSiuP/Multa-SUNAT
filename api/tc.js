// api/tc.js (Serverless Function - Node.js)
// Este script se ejecuta en el servidor (Vercel/Netlify) para evitar CORS.

import fetch from 'node-fetch'; // Necesario en Node.js, pero a menudo ya disponible en serverless.
import { URLSearchParams } from 'url';

// Parámetros de la API del BCRP
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD';
const FORMATO = 'json';

// Función Serverless principal (para Vercel/Netlify)
export default async function handler(req, res) {
    // 1. Obtener la fecha de la URL de la petición (ej: /api/tc?fecha=2025-10-01)
    const fechaStr = req.query.fecha;

    if (!fechaStr) {
        return res.status(400).json({ error: 'Falta el parámetro de fecha.' });
    }
    
    // 2. Ejecutar la función de obtención del TC
    try {
        const resultado = await obtenerTipoCambioServer(fechaStr);
        
        // 3. Devolver los datos obtenidos con éxito
        // CORS es resuelto automáticamente por Vercel/Netlify al usar este patrón
        res.status(200).json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Error al obtener el tipo de cambio.' });
    }
}

/**
 * Función central de consulta que se ejecuta en el servidor.
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @param {number} diasRestantes - Límite de intentos de búsqueda hacia atrás.
 */
async function obtenerTipoCambioServer(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio en el rango de búsqueda (5 días).");
    }

    try {
        const url = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        // Llama directamente al BCRP. CORS no es un problema aquí.
        const response = await fetch(url); 
        
        if (!response.ok) {
            throw new Error(`BCRP API falló con código ${response.status}`);
        }

        const data = await response.json();

        if (data.series && data.series.length > 0 && data.series[0].periodos && data.series[0].periodos.length > 0) {
            const tcValor = parseFloat(data.series[0].periodos[0].valores[0]);
            
            if (isNaN(tcValor) || tcValor <= 0) {
                throw new Error("Valor de tipo de cambio no encontrado para la fecha.");
            }
            
            return {
                tc: tcValor,
                fechaUtilizada: data.series[0].periodos[0].fecha
            };
        }
        
        // Retroceder un día si no hay datos (regla SUNAT)
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        return obtenerTipoCambioServer(fechaAnteriorStr, diasRestantes - 1);

    } catch (error) {
        console.error("Error en Serverless Function:", error);
        throw new Error("Error interno al consultar el BCRP.");
    }
}