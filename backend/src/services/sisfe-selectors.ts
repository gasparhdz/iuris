export const SEL = {
  search: {
    readyButton: "#efectuarBusqueda",
    cuijInput: 'input[formcontrolname="cuij"]',
    feedbackOrResult: "#mensajeOk, #mensajeError, .alert-danger, table tbody tr",
    okMessage: "#mensajeOk",
    resultRows: "table tbody tr",
    resultFirstLink: "td a",
    resultCells: "td",
  },
  detail: {
    root: "app-detalle-expediente",
    header: "app-encabezado-detalle",
    title: "app-encabezado-detalle h1, h1",
    dataRows: "app-encabezado-detalle p, app-detalle-expediente p",
    downloadButton: 'button:has-text("Descargar Expediente Digital"), button:has(i.fa-download)',
    grid: "app-detalle-expediente app-grilla",
    gridTable: "app-detalle-expediente app-grilla table",
    gridHeaders: "app-detalle-expediente app-grilla table thead th",
    gridRows: "app-detalle-expediente app-grilla table tbody tr",
    gridCells: "td",
    // El <li> contenedor del botón "Siguiente". Su clase indica el estado (enabled/disabled);
    // hay que chequearla antes de clickear porque el <a> interno matchea aunque esté deshabilitado.
    paginationNextItem: "app-detalle-expediente app-paginacion li.next-item",
    paginationNextLink: "app-detalle-expediente app-paginacion li.next-item a",
    paginationActive: "app-detalle-expediente app-paginacion li.active, app-detalle-expediente app-paginacion .active",
    iconSentence: "i.fa-gavel",
    iconNotification: "i.fa-user-check",
    iconDocument: "i.fa-file-alt",
    iconShield: "i.fa-shield-alt",
  },
} as const;
