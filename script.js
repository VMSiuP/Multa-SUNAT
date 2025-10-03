// script.js - SOLUCIÓN DEFINITIVA PARA GITHUB PAGES (usando proxy robusto)

document.getElementById('multaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fechaInput = document.getElementById('fechaInfraccion').value;
    const montoTributo = parseFloat(document.getElementById('montoTributo').value);

    // Limpiar y mostrar estado de carga
    document.getElementById('multaFinal').textContent = '';
    document.getElementById('tcInfo').textContent = '';
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    if (fechaInput && !isNaN(montoTributo) && montoTributo > 0) {
        calcularMulta(fechaInput, montoTributo);
    } else {
        mostrarError("Por favor, ingrese una fecha y un monto de tributo válido (mayor a 0).");
        document.getElementById('loading').style.display = 'none';
    }
});

// Parámetros de la API
// *PROXY ESTABLE*: Se ha cambiado a un proxy diferente, ya que 'allorigins' también puede fallar.
// Este patrón de proxy (JSONP o un servicio de proxy de JSON) es más fiable para entornos estáticos.
const PROXY_URL = 'https://cors-proxy.fringe.zone/api/?url='; // Proxy JSONP/API
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD'; // Tipo de Cambio Venta (dólar)
const FORMATO = 'json';

/**
 * Busca el tipo de cambio para una fecha, retrocediendo si es día no hábil.
 */
async function obtenerTipoCambio(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio en el rango de búsqueda (5 días). Revise la fecha.");
    }

    try {
        // 1. Construir la URL del BCRP
        const BCRP_URL = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        
        // 2. Usar el Proxy para resolver CORS.
        const urlConProxy = PROXY_URL + encodeURIComponent(BCRP_URL);

        const response = await fetch(urlConProxy);
        
        if (!response.ok) {
            throw new Error(`La solicitud al Proxy falló con código ${response.status}.`);
        }

        const data = await response.json();

        // 3. Procesar la respuesta del BCRP (que viene dentro del JSON del proxy)
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
        
        // 4. Retroceder un día si no hay datos (regla SUNAT)
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        console.log(`Buscando día hábil anterior: ${fechaAnteriorStr}`);
        return obtenerTipoCambio(fechaAnteriorStr, diasRestantes - 1);

    } catch (error) {
        // Manejo de errores de red o parsing
        throw new Error("Error de conexión al obtener el TC: " + error.message);
    }
}

/**
 * Realiza el cálculo final de la multa. (Mantenemos esta función igual)
 */
async function calcularMulta(fechaStr, montoUSD) {
    try {
        const { tc, fechaUtilizada } = await obtenerTipoCambio(fechaStr);
        
        // --- Lógica del Cálculo (2 x Tributo x TC) ---
        const multaFinalSoles = montoUSD * tc * 2;
        
        // --- Mostrar Resultado ---
        document.getElementById('loading').style.display = 'none';
        
        const formatter = new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2
        });

        document.getElementById('tcInfo').innerHTML = 
            `**T.C. Venta:** ${tc.toFixed(4)} S/ (Dato del BCRP para la fecha: ${fechaUtilizada.split('-').reverse().join('/')})`;
        
        document.getElementById('multaFinal').textContent = 
            `Multa Total: ${formatter.format(multaFinalSoles)}`;

    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        mostrarError(error.message);
    }
}

/**
 * Muestra mensajes de error en la UI.
 */
function mostrarError(mensaje) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = `ERROR: ${mensaje}`;
    errorDiv.style.display = 'block';
}
