// api/tc.js (Serverless Function - Node.js)
// Usa sintaxis CommonJS (require) para robustez en Netlify/Vercel.

const fetch = require('node-fetch'); // CAMBIO: Usamos require
// const { URLSearchParams } = require('url'); // No es necesario aquí

// Parámetros de la API del BCRP
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD';
const FORMATO = 'json';

// Función Serverless principal (para Netlify)
exports.handler = async (event, context) => { // CAMBIO: Usamos exports.handler
    // 1. Obtener la fecha del parámetro de consulta (queryStringParameters)
    const fechaStr = event.queryStringParameters.fecha;

    if (!fechaStr) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Falta el parámetro de fecha.' })
        };
    }
    
    // 2. Ejecutar la función de obtención del TC
    try {
        const resultado = await obtenerTipoCambioServer(fechaStr);
        
        // 3. Devolver los datos obtenidos con éxito
        return {
            statusCode: 200,
            body: JSON.stringify(resultado)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Error interno al obtener el tipo de cambio.' })
        };
    }
};

/**
 * Función central de consulta que se ejecuta en el servidor.
 */
async function obtenerTipoCambioServer(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio en el rango de búsqueda (5 días).");
    }

    try {
        const url = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        const response = await fetch(url);
        
        // La API del BCRP puede devolver HTML en algunos fallos. Intentamos analizar como texto primero.
        const text = await response.text();

        // 1. Intentar analizar como JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Si falla el parseo, es HTML o un error de la API del BCRP, lo cual es inmanejable.
            console.error("Respuesta no es JSON:", text.substring(0, 100) + '...');
            throw new Error(`La API del BCRP devolvió un formato inválido. (${fechaStr})`);
        }

        // 2. Verificar la estructura de datos
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
        
        // 3. Retroceder un día si no hay datos (regla SUNAT)
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        return obtenerTipoCambioServer(fechaAnteriorStr, diasRestantes - 1);

    } catch (error) {
        // Manejamos errores internos del servidor (network, fetch, etc.)
        throw new Error(error.message || "Error al consultar la API del BCRP.");
    }
}
