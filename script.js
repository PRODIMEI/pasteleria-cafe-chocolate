const fileInput = document.getElementById('fileInput');
const tableBody = document.querySelector('#dataTable tbody');
const searchInput = document.getElementById('searchInput');
const fechaInicioInput = document.getElementById('fechaInicio');
const fechaFinInput = document.getElementById('fechaFin');

let registros = [];

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => procesarArchivo(e.target.result);
    reader.readAsText(file);
});

//-------

function aplicarFiltros() {
    const texto = searchInput.value.toLowerCase();
    const inicio = fechaInicioInput.value;
    const fin = fechaFinInput.value;

    let filtrados = registros.filter(r => {
        const coincideTexto =
            r.nombre.toLowerCase().includes(texto) ||
            r.empleado.includes(texto);

        let coincideFecha = true;

        if (inicio) coincideFecha = r.fecha >= inicio;
        if (fin) coincideFecha = coincideFecha && r.fecha <= fin;

        return coincideTexto && coincideFecha;
    });

    mostrarTabla(filtrados);
}

//------


function procesarArchivo(texto) {
    const lineas = texto.split('\n');
    const mapa = {};

    lineas.forEach(linea => {
        if (!linea.trim()) return;
        if (linea.startsWith('#')) return;
        if (linea.startsWith('No\t')) return;

        const c = linea.split('\t');
        if (c.length < 10) return;

        const empleado = c[2].trim();
        const nombre = c[3].trim();
        const fechaHora = c[9].trim().split('  ');
        if (fechaHora.length < 2) return;

        const fecha = fechaHora[0];
        const hora = fechaHora[1];
        const key = `${empleado}-${fecha}`;

        if (!mapa[key]) {
            mapa[key] = {
                empleado,
                nombre,
                fecha,
                horas: [] // 👈 guardamos TODAS las horas
            };
        }

        mapa[key].horas.push(hora);
    });

    registros = Object.values(mapa).map(r => {
        r.horas.sort(); // 👈 orden cronológico

        if (r.horas.length >= 2) {
            r.entrada = r.horas[0];
            r.salida = r.horas[r.horas.length - 1];
            r.total = calcularHorasValidas(r.entrada, r.salida);
        } else {
            r.entrada = r.horas[0] ?? null;
            r.salida = null;
            r.total = 'Sin registro';
        }

        return r;
    });

    aplicarFiltros();
   // mostrarTabla(registros);
}

function calcularHorasValidas(entrada, salida) {
    if (!entrada || !salida) return 'Sin registro';

    const e = new Date(`1970-01-01T${entrada}`);
    let s = new Date(`1970-01-01T${salida}`);

    // Cruce de medianoche
    if (s < e) {
        s.setDate(s.getDate() + 1);
    }

    const diff = (s - e) / 60000;
    if (diff <= 0) return 'Sin registro';

    const h = Math.floor(diff / 60);
    const m = Math.floor(diff % 60);

    return `${h}h ${m}m`;
}

function mostrarTabla(data) {
    tableBody.innerHTML = '';

    // Ordenamos por fecha
    const ordenados = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));

    let fechaActual = '';

    ordenados.forEach(r => {

        // 👉 Si cambia la fecha, pintamos separador
        if (r.fecha !== fechaActual) {
            fechaActual = r.fecha;

            const sep = document.createElement('tr');
            sep.classList.add('separator-row');
            sep.innerHTML = `
                <td colspan="6">
                    <span>📅 ${formatearFecha(fechaActual)}</span>
                </td>
            `;
            tableBody.appendChild(sep);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.empleado}</td>
            <td>${r.nombre}</td>
            <td>${formatearFecha(r.fecha)}</td>
            <td>${r.entrada ?? 'Sin registro de entrada'}</td>
            <td>${r.salida ?? 'Sin registro de salida'}</td>
            <td>${r.total}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function formatearFecha(fecha) {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

searchInput.addEventListener('input', () => {
    const texto = searchInput.value.toLowerCase();
    const filtrados = registros.filter(r =>
        r.nombre.toLowerCase().includes(texto) ||
        r.empleado.includes(texto)
    );
    mostrarTabla(filtrados);
});

fechaInicioInput.addEventListener('change', aplicarFiltros);
fechaFinInput.addEventListener('change', aplicarFiltros);




const btnExportar = document.getElementById('btnExportar');

btnExportar.addEventListener('click', exportarExcel);

function exportarExcel() {
    if (!registros.length) {
        alert('No hay datos para exportar');
        return;
    }

    // Usamos los mismos filtros activos
    const texto = searchInput.value.toLowerCase();
    const inicio = fechaInicioInput.value;
    const fin = fechaFinInput.value;

    const datos = registros.filter(r => {
        const okTexto =
            r.nombre.toLowerCase().includes(texto) ||
            r.empleado.includes(texto);

        let okFecha = true;
        if (inicio) okFecha = r.fecha >= inicio;
        if (fin) okFecha = okFecha && r.fecha <= fin;

        return okTexto && okFecha;
    });

    if (!datos.length) {
        alert('No hay datos filtrados para exportar');
        return;
    }

    let csv = '\ufeff'; // BOM para Excel
    csv += 'No de Empleado,Nombre,Fecha,Registro de entrada,Registro de salida,Horas laboradas\n';

    datos
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .forEach(r => {
            csv += `"${r.empleado}","${r.nombre}","${formatearFecha(r.fecha)}","${r.entrada ?? ''}","${r.salida ?? ''}","${r.total}"\n`;
        });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `checador_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
}



// 📌 Exportar a PDF

const btnPDF = document.getElementById('btnPDF');
btnPDF.addEventListener('click', exportarPDF);

function exportarPDF() {
    if (!registros.length) {
        alert('No hay datos para exportar');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // 📌 Título
    doc.setFontSize(14);
    doc.text('PASTELERIA CAFE CHOCOLATE', 105, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.text('Control de Personal', 105, 22, { align: 'center' });

    // 🔎 aplicar mismos filtros visibles
    const texto = searchInput.value.toLowerCase();
    const inicio = fechaInicioInput.value;
    const fin = fechaFinInput.value;

    const datos = registros.filter(r => {
        const okTexto =
            r.nombre.toLowerCase().includes(texto) ||
            r.empleado.includes(texto);

        let okFecha = true;
        if (inicio) okFecha = r.fecha >= inicio;
        if (fin) okFecha = okFecha && r.fecha <= fin;

        return okTexto && okFecha;
    });

    if (!datos.length) {
        alert('No hay datos filtrados');
        return;
    }

    // 📋 Construcción del BODY igual que la tabla HTML
    const body = [];
    let fechaActual = '';

    datos
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .forEach(r => {

            // 📅 separador por día
            if (r.fecha !== fechaActual) {
                fechaActual = r.fecha;

                body.push([
                    {
                        content: ` ${formatearFecha(fechaActual)}`,
                        colSpan: 6,
                        styles: {
                            fillColor: [230, 230, 230],
                            textColor: 20,
                            fontStyle: 'bold'
                        }
                    }
                ]);
            }

            body.push([
                r.empleado,
                r.nombre,
                formatearFecha(r.fecha),
                r.entrada ?? 'Sin registro de entrada',
                r.salida ?? 'Sin registro de salida',
                r.total
            ]);
        });

    // 🧾 UNA sola tabla (como en la página)
    doc.autoTable({
        startY: 30,
        head: [[
            'No de Empleado',
            'Nombre',
            'Fecha',
            'Registro de Entrada',
            'Registro de Salida',
            'Horas Laboradas'
        ]],
        body: body,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 2
        },
        headStyles: {
            fillColor: [52, 73, 94],
            textColor: 255
        },
        margin: { left: 10, right: 10 }
    });

    doc.save(`checador_${new Date().toISOString().slice(0,10)}.pdf`);
}
