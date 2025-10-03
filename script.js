document.getElementById('multaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fechaInput = document.getElementById('fechaInfraccion').value;
    const montoTributo = parseFloat(document.getElementById('montoTributo').value);

    // Limpiar resultados anteriores
    document.getElementById('multaFinal').textContent = '';
    document.getElementById('tcInfo').textContent = '';
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    if (fechaInput && !isNaN(montoTributo) && montoTributo > 0) {
        calcularMulta(fechaInput, montoTributo);
    } else {
        mostrarError("Por favor, ingrese una fecha y un monto de tributo válido.");
    }
});

// Parámetros de la API
const BCRP_API_BASE = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/';
const TC_VENTA_SERIE = 'PD04641PD'; // Código para Tipo de Cambio Venta (dólar)
const FORMATO = 'json';

/**
 * Busca el tipo de cambio para una fecha dada, retrocediendo si es día no hábil.
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @param {number} maxDias - Máximo de días a retroceder (seguridad para evitar bucles infinitos)
 */
async function obtenerTipoCambio(fechaStr, maxDias = 5) {
    if (maxDias <= 0) {
        throw new Error("No se pudo obtener el Tipo de Cambio después de varios intentos. Intente con una fecha más cercana.");
    }

    try {
        const url = `${BCRP_API_BASE}${TC_VENTA_SERIE}/${FORMATO}/${fechaStr}/${fechaStr}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error en la consulta a la API BCRP: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificar si la serie tiene datos (la API retorna un array de series)
        if (data.series && data.series.length > 0 && data.series[0].periodos && data.series[0].periodos.length > 0) {
            
            // El valor del tipo de cambio está en data.series[0].periodos[0].valores[0]
            const tcValor = parseFloat(data.series[0].periodos[0].valores[0]);
            
            if (isNaN(tcValor)) {
                throw new Error("Valor de tipo de cambio no encontrado para la fecha.");
            }
            
            return {
                tc: tcValor,
                fechaUtilizada: data.series[0].periodos[0].fecha // Fecha real del dato
            };
        }
        
        // Si no hay datos para esa fecha, retroceder al día anterior (regla SUNAT)
        const fechaActual = new Date(fechaStr + 'T00:00:00'); // 'T00:00:00' para evitar problemas de zona horaria
        fechaActual.setDate(fechaActual.getDate() - 1);
        const fechaAnteriorStr = fechaActual.toISOString().slice(0, 10);
        
        return obtenerTipoCambio(fechaAnteriorStr, maxDias - 1);

    } catch (error) {
        console.error("Error al obtener TC:", error);
        throw new Error("Error de conexión o formato de la API: " + error.message);
    }
}

/**
 * Realiza el cálculo final de la multa.
 */
async function calcularMulta(fechaStr, montoUSD) {
    try {
        const { tc, fechaUtilizada } = await obtenerTipoCambio(fechaStr);
        
        // --- Lógica del Cálculo ---
        // 1. Convertir tributo dejado de pagar a Soles (S/)
        const tributoEnSoles = montoUSD * tc;
        
        // 2. Aplicar la multa (2 veces el tributo dejado de pagar)
        const multaFinalSoles = tributoEnSoles * 2;
        
        // --- Mostrar Resultado ---
        document.getElementById('loading').style.display = 'none';
        
        // Formato para Soles Peruanos (S/ 1,234.56)
        const formatter = new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2
        });

        document.getElementById('tcInfo').innerHTML = 
            `**T.C. Venta:** ${tc.toFixed(4)} S/ (Fecha del dato: ${fechaUtilizada.split('-').reverse().join('/')})`;
        
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