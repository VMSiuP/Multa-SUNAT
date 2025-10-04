// api/tc.js (Serverless Function - Node.js) - CÓDIGO FINAL DE CORRECCIÓN DE DATOS

const fetch = require('node-fetch');
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD';
const FORMATO = 'json';

exports.handler = async (event, context) => {
    const fechaStr = event.queryStringParameters.fecha;

    if (!fechaStr) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Falta el parámetro de fecha.' }) };
    }
    
    try {
        const resultado = await obtenerTipoCambioServer(fechaStr);
        return { statusCode: 200, body: JSON.stringify(resultado) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Error desconocido del servidor.' }) };
    }
};

/**
 * Función central de consulta que consulta al BCRP y maneja el retroceso de fechas.
 */
async function obtenerTipoCambioServer(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio en 5 días. La fecha podría ser muy antigua o errónea.");
    }

    const url = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
    const response = await fetch(url);
    const text = await response.text();

    let data = {};
    try {
        data = JSON.parse(text);
    } catch (e) {
        // Si no es JSON, asumimos que el BCRP no devolvió datos válidos (casi siempre, día no hábil).
        console.log(`[BCRP NO JSON] Retrocediendo de ${fechaStr}`);
        // Forzamos el retroceso de fecha
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        return obtenerTipoCambioServer(fechaAnteriorStr, diasRestantes - 1);
    }

    // 1. Verificar si hay datos válidos en la estructura JSON
    if (data.series && data.series.length > 0 && data.series[0].periodos && data.series[0].periodos.length > 0) {
        const tcValor = parseFloat(data.series[0].periodos[0].valores[0]);
        
        if (isNaN(tcValor) || tcValor <= 0) {
            // Si encuentra la estructura pero el valor es nulo (raro), intenta retroceder
            console.log(`[BCRP VALOR INVÁLIDO] Retrocediendo de ${fechaStr}`);
        } else {
            // ÉXITO: Devolver el TC
            return {
                tc: tcValor,
                fechaUtilizada: data.series[0].periodos[0].fecha
            };
        }
    }
    
    // 2. Si llega aquí (no es JSON O JSON está vacío), retroceder un día.
    const fechaActual = new Date(fechaStr + 'T00:00:00');
    fechaActual.setDate(fechaActual.getDate() - 1);
    const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
    
    return obtenerTipoCambioServer(fechaAnteriorStr, diasRestantes - 1);
}
