import { defaultOptions } from 'primevue/config';

// PrimeVue consumes its own locale for screen-reader messages and built-in
// controls. Keep those messages in sync with the application's visible labels.
const spanish = {
  startsWith: 'Empieza con', contains: 'Contiene', notContains: 'No contiene', endsWith: 'Termina con', equals: 'Igual a', notEquals: 'Diferente de', noFilter: 'Sin filtro',
  lt: 'Menor que', lte: 'Menor o igual que', gt: 'Mayor que', gte: 'Mayor o igual que', dateIs: 'La fecha es', dateIsNot: 'La fecha no es', dateBefore: 'La fecha es anterior a', dateAfter: 'La fecha es posterior a',
  clear: 'Limpiar', apply: 'Aplicar', matchAll: 'Coincidir con todos', matchAny: 'Coincidir con alguno', addRule: 'Añadir regla', removeRule: 'Eliminar regla', accept: 'Sí', reject: 'No', choose: 'Elegir', upload: 'Subir', cancel: 'Cancelar', completed: 'Completado', pending: 'Pendiente',
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  chooseYear: 'Elegir año', chooseMonth: 'Elegir mes', chooseDate: 'Elegir fecha', prevDecade: 'Década anterior', nextDecade: 'Década siguiente', prevYear: 'Año anterior', nextYear: 'Año siguiente', prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente', prevHour: 'Hora anterior', nextHour: 'Hora siguiente', prevMinute: 'Minuto anterior', nextMinute: 'Minuto siguiente', prevSecond: 'Segundo anterior', nextSecond: 'Segundo siguiente', today: 'Hoy', weekHeader: 'Sem', dateFormat: 'dd/mm/yy',
  weak: 'Débil', medium: 'Media', strong: 'Fuerte', passwordPrompt: 'Ingresa una contraseña', emptyFilterMessage: 'No se encontraron resultados', searchMessage: 'Hay {0} resultados disponibles', selectionMessage: '{0} elementos seleccionados', emptySelectionMessage: 'Ningún elemento seleccionado', emptySearchMessage: 'No se encontraron resultados', fileChosenMessage: '{0} archivos', noFileChosenMessage: 'Ningún archivo elegido', emptyMessage: 'No hay opciones disponibles',
  aria: {
    trueLabel: 'Verdadero', falseLabel: 'Falso', nullLabel: 'Sin seleccionar', star: '1 estrella', stars: '{star} estrellas', selectAll: 'Todos los elementos seleccionados', unselectAll: 'Todos los elementos deseleccionados', close: 'Cerrar', previous: 'Anterior', next: 'Siguiente', navigation: 'Navegación', scrollTop: 'Ir al inicio', moveTop: 'Mover al inicio', moveUp: 'Mover hacia arriba', moveDown: 'Mover hacia abajo', moveBottom: 'Mover al final', moveToTarget: 'Mover al destino', moveToSource: 'Mover al origen', moveAllToTarget: 'Mover todos al destino', moveAllToSource: 'Mover todos al origen',
    pageLabel: 'Página {page}', firstPageLabel: 'Primera página', lastPageLabel: 'Última página', nextPageLabel: 'Página siguiente', prevPageLabel: 'Página anterior', rowsPerPageLabel: 'Filas por página', jumpToPageDropdownLabel: 'Lista para ir a una página', jumpToPageInputLabel: 'Campo para ir a una página', selectRow: 'Fila seleccionada', unselectRow: 'Fila deseleccionada', expandRow: 'Fila expandida', collapseRow: 'Fila contraída', showFilterMenu: 'Mostrar menú de filtros', hideFilterMenu: 'Ocultar menú de filtros', filterOperator: 'Operador de filtro', filterConstraint: 'Condición de filtro', editRow: 'Editar fila', saveEdit: 'Guardar edición', cancelEdit: 'Cancelar edición', listView: 'Vista de lista', gridView: 'Vista de cuadrícula', slide: 'Diapositiva', slideNumber: '{slideNumber}', zoomImage: 'Ampliar imagen', zoomIn: 'Acercar', zoomOut: 'Alejar', rotateRight: 'Girar a la derecha', rotateLeft: 'Girar a la izquierda', listLabel: 'Lista de opciones',
  },
};

export function primeVueLocale(language) {
  const overrides = language === 'es' ? spanish : {};
  return { ...defaultOptions.locale, ...overrides, aria: { ...defaultOptions.locale.aria, ...(overrides.aria || {}) } };
}
