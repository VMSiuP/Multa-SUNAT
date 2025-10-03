// script.js (Frontend - Llama al micro-servicio local)

document.getElementById('multaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fechaInput = document.getElementById('fechaInfraccion').value;
    const montoTributo = parseFloat(document.getElementById('montoTributo').value);

    document.getElementById('multaFinal').textContent = '';
    document.getElementById('tcInfo').textContent = '';
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    if (fechaInput && !isNaN(montoTributo) && montoTributo > 0) {
        calcularMulta(fechaInput, montoTributo);
    } else {
        mostrarError("Por favor, ingrese una fecha y un monto de tributo válido.");
        document.getElementById('loading').style.display = 'none';
    }
});

// URL de tu nuevo micro-servicio, que Vercel/Netlify mapean a api/tc.js
const INTERNAL_API_URL = '/api/tc'; 

/**
 * Busca el tipo de cambio llamando a la función Serverless del propio despliegue.
 * Esto resuelve el problema de CORS y de proxies inestables.
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 */
async function obtenerTipoCambio(fechaStr) {
    try {
        const url = `${INTERNAL_API_URL}?fecha=${fechaStr}`;
        const response = await fetch(url);
        
        const data = await response.json();
        
        if (!response.ok) {
            // Si el backend devolvió un error (400, 500, etc.)
            throw new Error(data.error || 'Error desconocido en el micro-servicio.');
        }

        // Si la respuesta es exitosa (200)
        return data; 
        
    } catch (error) {
        console.error("Error al obtener TC:", error);
        throw new Error("Error de conexión con el servicio de tipo de cambio: " + error.message);
    }
}

/**
 * Realiza el cálculo final de la multa.
 */
async function calcularMulta(fechaStr, montoUSD) {
    try {
        // La función obtenerTipoCambio ahora llama al micro-servicio
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
