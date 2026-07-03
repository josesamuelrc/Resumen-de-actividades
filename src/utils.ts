/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkDay, Task, TaskCategory, CATEGORY_COLORS } from './types';

// Helper to calculate duration in minutes between HH:MM and HH:MM
export function calculateDurationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  let startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  
  // Handle cross-midnight shift (if end time is earlier than start time)
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }
  
  return endTotal - startTotal;
}

// Helper to format minutes into human readable text (e.g. 1h 30m or 45m)
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`.trim();
  }
  return `${remainingMins}m`;
}

// Generate the beautiful WhatsApp report for a single work day
export function generateWhatsAppReport(workDay: WorkDay): string {
  const { personName, date, tasks } = workDay;
  
  // Format date to readable local format (e.g., Jueves, 2 de Julio)
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Capitalize first letter of the weekday
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  let totalMinutes = 0;
  let taskLines = '';
  let categorySummary: Record<string, number> = {};

  tasks.forEach((task, index) => {
    const duration = calculateDurationMinutes(task.startTime, task.endTime);
    totalMinutes += duration;
    
    // Determine the category display name
    const finalCategory = task.category === 'Otro' && task.customCategory ? task.customCategory : task.category;
    
    // Accumulate category durations
    categorySummary[finalCategory] = (categorySummary[finalCategory] || 0) + duration;

    const emoji = CATEGORY_COLORS[task.category]?.emoji || '📝';
    const durationStr = formatMinutes(duration);
    
    taskLines += `• *[${task.startTime} - ${task.endTime}]* (${durationStr})\n`;
    taskLines += `  ${emoji} *${task.title}*\n`;
    taskLines += `  _Categoría:_ ${finalCategory}\n`;
    if (task.notes && task.notes.trim() !== '') {
      taskLines += `  _Nota:_ ${task.notes.trim()}\n`;
    }
    taskLines += `\n`;
  });

  const totalDurationStr = formatMinutes(totalMinutes);
  
  // Build category summary block with mini percentages or simple minutes
  let summaryBlock = '';
  if (totalMinutes > 0) {
    summaryBlock += `📊 *Resumen de Tiempos por Categoría:*\n`;
    Object.entries(categorySummary).forEach(([cat, mins]) => {
      const pct = Math.round((mins / totalMinutes) * 100);
      const catEmoji = CATEGORY_COLORS[cat as TaskCategory]?.emoji || '📝';
      summaryBlock += `${catEmoji} *${cat}:* ${formatMinutes(mins)} (${pct}%)\n`;
    });
  }

  const report = `*🚀 REPORTE DE JORNADA LABORAL (QC) 🚀*
--------------------------------------------
👤 *Colaborador:* ${personName || 'No especificado'}
📅 *Fecha:* ${capitalizedDate}
⏱️ *Tiempo Total Registrado:* ${totalDurationStr}
--------------------------------------------

📝 *ACTIVIDADES REALIZADAS:*

${taskLines || '_No se registraron tareas en este día._\n'}
${summaryBlock}
--------------------------------------------
_Generado automáticamente con Registro de Control de Calidad_ ⚡`;

  return report;
}

// Generate high quality sample data so the dashboard charts look active on first load
export function getSampleData(personName: string = 'Jose Samuel'): WorkDay[] {
  const today = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];
  
  const sampleDays: WorkDay[] = [];
  
  // Define tasks for previous 5 workdays to create an authentic weekly history in QC
  const activities = [
    {
      offset: 0, // Today
      tasks: [
        { id: 't1', title: 'Inspección visual de lote de materia prima entrante', category: 'Inspección de Lote', startTime: '09:00', endTime: '10:15', notes: 'Lote #8849 verificado sin desviaciones' },
        { id: 't2', title: 'Pruebas físicas de tensión y elongación en laboratorio', category: 'Prueba de Laboratorio', startTime: '10:30', endTime: '13:00', notes: 'Material cumple con especificación ASTM' },
        { id: 't3', title: 'Almuerzo y pausa activa', category: 'Pausa', startTime: '13:00', endTime: '14:00' },
        { id: 't4', title: 'Auditoría de proceso de llenado en línea de envasado', category: 'Auditoría de Proceso', startTime: '14:00', endTime: '16:30', notes: 'Se detectó pequeña variación en sellado térmico' },
        { id: 't5', title: 'Registro de no conformidad y propuesta de acción correctiva', category: 'Gestión de No Conformidades', startTime: '16:45', endTime: '18:00', notes: 'Reportado a supervisor de producción' }
      ]
    },
    {
      offset: 1, // Yesterday
      tasks: [
        { id: 'y1', title: 'Calibración mensual de balanzas analíticas y micrómetros', category: 'Calibración de Equipos', startTime: '08:30', endTime: '10:00' },
        { id: 'y2', title: 'Reunión semanal de indicadores clave de calidad', category: 'Otro', startTime: '10:00', endTime: '11:30', notes: 'Análisis del porcentaje de rechazo en extrusión' },
        { id: 'y3', title: 'Elaboración de certificados de análisis de calidad para despacho', category: 'Elaboración de Reportes', startTime: '11:45', endTime: '13:15', notes: 'Liberados 3 despachos urgentes' },
        { id: 'y4', title: 'Almuerzo', category: 'Pausa', startTime: '13:15', endTime: '14:15' },
        { id: 'y5', title: 'Inspección de muestreo en empaque final antes de despacho', category: 'Inspección de Lote', startTime: '14:15', endTime: '16:45', notes: 'Aprobado para despacho final' },
        { id: 'y6', title: 'Organización de registros físicos e ingreso de datos en ERP', category: 'Elaboración de Reportes', startTime: '17:00', endTime: '18:00' }
      ]
    },
    {
      offset: 2, // 2 days ago
      tasks: [
        { id: 'd2_1', title: 'Pruebas de hermeticidad y sellado hidráulico en probetas', category: 'Prueba de Laboratorio', startTime: '09:00', endTime: '12:30', notes: 'Excelente resistencia en muestras de control' },
        { id: 'd2_2', title: 'Pausa de café', category: 'Pausa', startTime: '12:30', endTime: '12:50' },
        { id: 'd2_3', title: 'Atención a reclamo de cliente por posible desviación estática', category: 'Gestión de No Conformidades', startTime: '12:50', endTime: '14:00', notes: 'Se analizó muestra de retención, sin desviación' },
        { id: 'd2_4', title: 'Almuerzo de equipo', category: 'Pausa', startTime: '14:00', endTime: '15:15' },
        { id: 'd2_5', title: 'Auditoría interna de calidad al almacén de producto terminado', category: 'Auditoría de Proceso', startTime: '15:30', endTime: '16:30' },
        { id: 'd2_6', title: 'Carga de reportes de control estadístico en Excel', category: 'Elaboración de Reportes', startTime: '16:30', endTime: '17:30' }
      ]
    },
    {
      offset: 3, // 3 days ago
      tasks: [
        { id: 'd3_1', title: 'Reunión de alineación de estándares de calidad con producción', category: 'Otro', startTime: '09:30', endTime: '11:00' },
        { id: 'd3_2', title: 'Verificación de instrumentos ópticos de inspección', category: 'Calibración de Equipos', startTime: '11:15', endTime: '13:00' },
        { id: 'd3_3', title: 'Almuerzo', category: 'Pausa', startTime: '13:00', endTime: '14:00' },
        { id: 'd3_4', title: 'Inspección de primer lote piloto de nueva línea de producción', category: 'Inspección de Lote', startTime: '14:00', endTime: '17:00', notes: 'Se firmó el acta de aprobación de inicio de lote' },
        { id: 'd3_5', title: 'Cierre y firma de informes de inspección diarios', category: 'Elaboración de Reportes', startTime: '17:00', endTime: '17:45' }
      ]
    },
    {
      offset: 4, // 4 days ago
      tasks: [
        { id: 'd4_1', title: 'Inspección diaria de control de temperatura de almacenes', category: 'Auditoría de Proceso', startTime: '09:00', endTime: '09:30' },
        { id: 'd4_2', title: 'Pruebas destructivas de resistencia a la compresión', category: 'Prueba de Laboratorio', startTime: '09:30', endTime: '12:45' },
        { id: 'd4_3', title: 'Almuerzo rápido', category: 'Pausa', startTime: '13:00', endTime: '13:45' },
        { id: 'd4_4', title: 'Seguimiento de acción correctiva en línea de soplado', category: 'Gestión de No Conformidades', startTime: '13:45', endTime: '16:15', notes: 'Se validó el ajuste de los moldes' },
        { id: 'd4_5', title: 'Revisión y firma de certificados analíticos para despacho internacional', category: 'Elaboración de Reportes', startTime: '16:30', endTime: '18:00' }
      ]
    }
  ];

  activities.forEach(act => {
    const d = new Date();
    d.setDate(today.getDate() - act.offset);
    
    // Skip weekend days in initial sample (make it feel like a real Monday-Friday work week)
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0) d.setDate(d.getDate() - 2); // if Sunday, push back to Friday
    else if (dayOfWeek === 6) d.setDate(d.getDate() - 1); // if Saturday, push back to Friday

    sampleDays.push({
      date: format(d),
      personName,
      tasks: act.tasks as Task[]
    });
  });

  return sampleDays;
}

// Format date to short readable version for charts (e.g., "Mié 01" or "01 Jul")
export function formatChartDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  return `${days[d.getDay()]} ${d.getDate()}`;
}
