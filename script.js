document.getElementById('multaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    // Obtener y validar las entradas del usuario
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

// Parámetros y URL de la API
// *IMPORTANTE*: Se ha cambiado el proxy a 'https://api.allorigins.win/raw?url='
// para solucionar los problemas de bloqueo y CORS en el entorno de producción.
const PROXY_URL = 'https://api.allorigins.win/raw?url='; 
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD'; // Tipo de Cambio Venta (dólar)
const FORMATO = 'json';

/**
 * Busca el tipo de cambio para una fecha, retrocediendo si es día no hábil (regla SUNAT).
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @param {number} diasRestantes - Límite de intentos de búsqueda hacia atrás.
 */
async function obtenerTipoCambio(fechaStr, diasRestantes = 5) {
    if (diasRestantes <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio en el rango de búsqueda (5 días). Intente con una fecha más reciente.");
    }

    try {
        // 1. Construir la URL del BCRP para la fecha actual
        const BCRP_URL = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        
        // 2. Usar el Proxy para sortear el bloqueo CORS. La URL del BCRP debe ser codificada.
        const urlConProxy = PROXY_URL + encodeURIComponent(BCRP_URL);

        const response = await fetch(urlConProxy);
        
        if (!response.ok) {
            throw new Error(`La solicitud a la API BCRP falló: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 3. Procesar la respuesta para verificar si hay datos
        if (data.series && data.series.length > 0 && data.series[0].periodos && data.series[0].periodos.length > 0) {
            
            const tcValor = parseFloat(data.series[0].periodos[0].valores[0]);
            
            if (isNaN(tcValor) || tcValor <= 0) {
                // Si el valor es inválido, puede significar un error de datos.
                throw new Error("Valor de tipo de cambio no válido para la fecha consultada.");
            }
            
            // Éxito: devolver el TC y la fecha real del dato
            return {
                tc: tcValor,
                fechaUtilizada: data.series[0].periodos[0].fecha
            };
        }
        
        // 4. Si no hay datos (día no hábil), retroceder un día y reintentar
        const fechaActual = new Date(fechaStr + 'T00:00:00');
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        console.log(`Fecha no hábil o sin datos. Buscando el día hábil anterior: ${fechaAnteriorStr}`);
        return obtenerTipoCambio(fechaAnteriorStr, diasRestantes - 1);

    } catch (error) {
        // Manejo de errores de red o parsing
        throw new Error("Error de conexión o formato de la API: " + error.message);
    }
}

/**
 * Realiza el cálculo final de la multa.
 */
async function calcularMulta(fechaStr, montoUSD) {
    try {
        const { tc, fechaUtilizada } = await obtenerTipoCambio(fechaStr);
        
        // --- Lógica del Cálculo (2 x Tributo x TC) ---
        // Formula: Multa (S/) = 2 * Monto USD * TC Venta
        const multaFinalSoles = montoUSD * tc * 2;
        
        // --- Mostrar Resultado ---
        document.getElementById('loading').style.display = 'none';
        
        // Formato de moneda peruana (S/)
        const formatter = new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2
        });

        // Mostrar información del TC utilizado
        document.getElementById('tcInfo').innerHTML = 
            `**T.C. Venta:** ${tc.toFixed(4)} S/ (Dato del BCRP para la fecha: ${fechaUtilizada.split('-').reverse().join('/')})`;
        
        // Mostrar la multa final
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
