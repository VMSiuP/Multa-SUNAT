// script.js (Frontend - Llama al micro-servicio interno)

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

// Usamos la ruta limpia que el netlify.toml redirige
const INTERNAL_API_URL = '/api/tc'; 

/**
 * Llama a la función Serverless del propio despliegue.
 */
async function obtenerTipoCambio(fechaStr) {
    try {
        const url = `${INTERNAL_API_URL}?fecha=${fechaStr}`;
        const response = await fetch(url);
        
        const data = await response.json();
        
        if (!response.ok) {
            // Si el backend devolvió un error (400, 500), el mensaje está en data.error
            throw new Error(data.error || 'Error desconocido en el micro-servicio.');
        }

        return data; 
        
    } catch (error) {
        console.error("Error al obtener TC:", error);
        throw new Error("Error de conexión con el servicio de tipo de cambio: " + error.message);
    }
}

/**
 * Realiza el cálculo final de la multa. (Lógica de 2x tributo)
 */
async function calcularMulta(fechaStr, montoUSD) {
    try {
        const { tc, fechaUtilizada } = await obtenerTipoCambio(fechaStr);
        
        const multaFinalSoles = montoUSD * tc * 2;
        
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
