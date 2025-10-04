// api/tc.js (Serverless Function - Node.js)

const fetch = require('node-fetch'); // Usamos require para compatibilidad
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD';
const FORMATO = 'json';

// Punto de entrada de la función serverless de Netlify
exports.handler = async (event, context) => {
    // Obtener la fecha del parámetro de consulta (ej: ?fecha=YYYY-MM-DD)
    const fechaStr = event.queryStringParameters.fecha;

    if (!fechaStr) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Falta el parámetro de fecha.' })
        };
    }
    
    try {
        const resultado = await obtenerTipoCambioServer(fechaStr);
        
        return {
            statusCode: 200,
            body: JSON.stringify(resultado) // Devolvemos el resultado en JSON
        };
    } catch (error) {
        // Devolvemos el error del backend con código 500
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Error interno al obtener el tipo de cambio.' })
        };
    }
};

/**
 * Función central que consulta al BCRP y maneja el retroceso de fechas.
 */
async function obtenerTipoCambioServer(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio después de 5 intentos. Intente con otra fecha.");
    }

    try {
        const url = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        const response = await fetch(url);
        
        // Leemos la respuesta como texto para evitar fallos de JSON si el BCRP devuelve HTML
        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text); // Intentamos analizar como JSON
        } catch (e) {
            // Si el parseo falla, asumimos que el BCRP devolvió un error HTML inmanejable.
            throw new Error(`La API del BCRP devolvió un formato de error inesperado para la fecha ${fechaStr}.`);
        }

        // Verificar la estructura de datos
        if (data.series && data.series.length > 0 && data.series[0].periodos && data.series[0].periodos.length > 0) {
            
            const tcValor = parseFloat(data.series[0].periodos[0].valores[0]);
            
            if (isNaN(tcValor) || tcValor <= 0) {
                throw new Error("Valor de tipo de cambio no válido para la fecha consultada.");
            }
            
            // Éxito: devolver el TC y la fecha real del dato
            return {
                tc: tcValor,
                fechaUtilizada: data.series[0].periodos[0].fecha
            };
        }
        
        // Si no hay datos, retroceder un día (regla SUNAT)
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        return obtenerTipoCambioServer(fechaAnteriorStr, diasRestantes - 1);

    } catch (error) {
        throw new Error(error.message || "Error al consultar la API del BCRP.");
    }
}
