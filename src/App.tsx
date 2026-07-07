/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  Check, 
  Copy, 
  Send, 
  BarChart2, 
  PieChart, 
  Award, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Coffee, 
  Info,
  CalendarDays,
  FileText,
  TrendingUp,
  UserCheck,
  RotateCcw,
  Database,
  Cloud,
  CloudOff,
  Edit2,
  Download
} from 'lucide-react';
import { WorkDay, Task, TaskCategory, CATEGORY_COLORS } from './types';
import { 
  calculateDurationMinutes, 
  formatMinutes, 
  generateWhatsAppReport, 
  getSampleData, 
  formatChartDate,
  generateCSV
} from './utils';
import { 
  isSupabaseConfigured, 
  syncLocalWithSupabase, 
  upsertWorkDay 
} from './lib/supabase';

const COLLABORATORS = [
  'Jose Samuel', 'Dayana', 'Fray', 'Jose Segovia', 'Bruno', 'Diego', 
  'Darwin', 'Gabriela', 'Maria Jose', 'Steffany', 'Betty', 'Aaron'
];

export default function App() {
  // State for person's name
  const [personName, setPersonName] = useState<string>(() => {
    const saved = localStorage.getItem('productivity_person_name');
    return saved || 'Jose Samuel';
  });

  // Selected date state (defaults to today's local date)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Master state: all recorded workdays
  const [workDays, setWorkDays] = useState<WorkDay[]>(() => {
    const saved = localStorage.getItem('productivity_workdays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing workdays from localStorage', e);
      }
    }
    return [];
  });

  // Active form state for adding a new task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Inspección de Lote');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [taskNotes, setTaskNotes] = useState('');

  // UI state feedback
  const [copySuccess, setCopySuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeChartTab, setActiveChartTab] = useState<'hours' | 'categories'>('hours');
  const [hoveredChartBar, setHoveredChartBar] = useState<string | null>(null);

  // Connection and Sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'not-configured'>('idle');

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Reset editing mode if collaborator or selected date changes to prevent accidental saves to wrong days
  useEffect(() => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskNotes('');
    setCustomCategoryName('');
  }, [selectedDate, personName]);

  // Synchronize person name to localStorage
  useEffect(() => {
    localStorage.setItem('productivity_person_name', personName);
  }, [personName]);

  // Synchronize all work days to localStorage
  useEffect(() => {
    localStorage.setItem('productivity_workdays', JSON.stringify(workDays));
  }, [workDays]);

  // Initial Sync on Mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSyncStatus('not-configured');
      return;
    }

    const performSync = async () => {
      try {
        setSyncStatus('syncing');
        // Get initial local state directly
        const saved = localStorage.getItem('productivity_workdays');
        let localDays: WorkDay[] = [];
        if (saved) {
          try {
            localDays = JSON.parse(saved);
          } catch (e) {
            console.error('Failed to parse local storage for sync:', e);
          }
        }

        const merged = await syncLocalWithSupabase(localDays);
        setWorkDays(merged);
        setSyncStatus('synced');
        triggerToast('☁️ Datos sincronizados con Supabase correctamente.');
      } catch (error) {
        console.error('Failed to perform initial sync:', error);
        setSyncStatus('error');
        triggerToast('⚠️ Error al conectar con Supabase. Usando respaldo local.');
      }
    };

    performSync();
  }, []);

  // Background auto-save effect
  useEffect(() => {
    if (syncStatus !== 'synced') return;
    if (!isSupabaseConfigured) return;

    // Find current active day in state
    const dayToSync = workDays.find(wd => wd.date === selectedDate && wd.personName === personName) || {
      date: selectedDate,
      personName: personName,
      tasks: []
    };

    const timer = setTimeout(async () => {
      try {
        await upsertWorkDay(dayToSync);
        console.log(`Auto-saved day ${selectedDate} for ${personName} to Supabase.`);
      } catch (error) {
        console.error('Error auto-saving to Supabase:', error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [workDays, selectedDate, personName, syncStatus]);

  // Toast feedback helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Find or create WorkDay entry for the currently selected date and person
  const currentWorkDay = useMemo(() => {
    let day = workDays.find(wd => wd.date === selectedDate && wd.personName === personName);
    if (!day) {
      day = {
        date: selectedDate,
        personName: personName,
        tasks: []
      };
    }
    return day;
  }, [workDays, selectedDate, personName]);

  // Daily goals based on the collaborator name (Bruno, Gabriela, and Steffany have 11h, others 8h)
  const dailyGoalHours = useMemo(() => {
    return ['Bruno', 'Gabriela', 'Steffany'].includes(personName) ? 11 : 8;
  }, [personName]);

  const dailyGoalMinutes = useMemo(() => {
    return dailyGoalHours * 60;
  }, [dailyGoalHours]);

  // Sorted list of tasks for the current selected day (chronologically by start time)
  const sortedTasks = useMemo(() => {
    return [...currentWorkDay.tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [currentWorkDay]);

  // Handle adding or updating an activity/task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      triggerToast('⚠️ Por favor escribe una descripción para la actividad.');
      return;
    }

    // Basic time overlap or logical check
    const startMins = startTime.split(':').map(Number);
    const endMins = endTime.split(':').map(Number);
    const startVal = startMins[0] * 60 + startMins[1];
    const endVal = endMins[0] * 60 + endMins[1];

    if (startVal === endVal) {
      triggerToast('⚠️ La hora de inicio y finalización no pueden ser iguales.');
      return;
    }

    if (endVal < startVal) {
      triggerToast('⚠️ La hora de finalización no puede ser anterior a la de inicio.');
      return;
    }

    // Check if there is an overlapping task
    const overlappingTask = currentWorkDay.tasks.find(t => {
      // If we are editing, ignore the task itself
      if (editingTaskId && t.id === editingTaskId) {
        return false;
      }
      
      const tStartMins = t.startTime.split(':').map(Number);
      const tEndMins = t.endTime.split(':').map(Number);
      const tStartVal = tStartMins[0] * 60 + tStartMins[1];
      const tEndVal = tEndMins[0] * 60 + tEndMins[1];
      
      // Overlap condition: StartA < EndB and EndA > StartB
      return startVal < tEndVal && endVal > tStartVal;
    });

    if (overlappingTask) {
      triggerToast(`⚠️ El horario se cruza con otra actividad: "${overlappingTask.title}" (${overlappingTask.startTime} - ${overlappingTask.endTime})`);
      return;
    }

    if (taskCategory === 'Otro' && !customCategoryName.trim()) {
      triggerToast('⚠️ Por favor escribe el nombre de la categoría personalizada.');
      return;
    }

    if (editingTaskId) {
      // Update existing task
      setWorkDays(prev => {
        return prev.map(wd => {
          if (wd.date === selectedDate && wd.personName === personName) {
            return {
              ...wd,
              tasks: wd.tasks.map(t => t.id === editingTaskId ? {
                ...t,
                title: taskTitle.trim(),
                category: taskCategory,
                startTime,
                endTime,
                notes: taskNotes.trim() || undefined,
                ...(taskCategory === 'Otro' ? { customCategory: customCategoryName.trim() } : { customCategory: undefined })
              } : t)
            };
          }
          return wd;
        });
      });
      setEditingTaskId(null);
      triggerToast('✅ ¡Actividad editada correctamente!');

      // Reset fields
      setTaskTitle('');
      setTaskNotes('');
      setCustomCategoryName('');
      return;
    }

    const newTask: Task = {
      id: 'task_' + Date.now(),
      title: taskTitle.trim(),
      category: taskCategory,
      startTime,
      endTime,
      notes: taskNotes.trim() || undefined,
      ...(taskCategory === 'Otro' ? { customCategory: customCategoryName.trim() } : {})
    };

    // Update workDays state
    setWorkDays(prev => {
      const existingDayIndex = prev.findIndex(wd => wd.date === selectedDate && wd.personName === personName);
      
      if (existingDayIndex >= 0) {
        // Update existing day
        const updated = [...prev];
        updated[existingDayIndex] = {
          ...updated[existingDayIndex],
          personName, // Sync name in case it changed
          tasks: [...updated[existingDayIndex].tasks, newTask]
        };
        return updated;
      } else {
        // Add new day entry
        return [
          ...prev,
          {
            date: selectedDate,
            personName,
            tasks: [newTask]
          }
        ];
      }
    });

    // Reset task fields, but keep reasonable default times for the next entry
    setTaskTitle('');
    setTaskNotes('');
    setCustomCategoryName('');
    setStartTime(endTime); // Shift start time to current end time for consecutive logging
    
    // Add 1 hour to end time for easy consecutive entry
    const [h, m] = endTime.split(':').map(Number);
    const nextH = (h + 1) % 24;
    const nextHStr = nextH.toString().padStart(2, '0');
    setEndTime(`${nextHStr}:${m.toString().padStart(2, '0')}`);
    
    triggerToast('✅ ¡Actividad agregada correctamente!');
  };

  // Start editing an existing task
  const handleStartEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskCategory(task.category);
    setCustomCategoryName(task.customCategory || '');
    setStartTime(task.startTime);
    setEndTime(task.endTime);
    setTaskNotes(task.notes || '');
    
    // Scroll form to view smoothly
    const formElement = document.getElementById('activity-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskNotes('');
    setCustomCategoryName('');
    setStartTime('09:00');
    setEndTime('10:00');
  };

  // Set quick times (e.g. current hour now)
  const setQuickTime = (type: 'start' | 'end') => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    if (type === 'start') {
      setStartTime(timeStr);
    } else {
      setEndTime(timeStr);
    }
  };

  // Delete a specific task
  const handleDeleteTask = (taskId: string) => {
    setWorkDays(prev => {
      return prev.map(wd => {
        if (wd.date === selectedDate && wd.personName === personName) {
          return {
            ...wd,
            tasks: wd.tasks.filter(t => t.id !== taskId)
          };
        }
        return wd;
      }).filter(wd => wd.tasks.length > 0 || (wd.date === selectedDate && wd.personName === personName)); // Keep empty today to allow logging
    });
    triggerToast('🗑️ Actividad eliminada.');
  };

  // Copy report to clipboard
  const handleCopyReport = () => {
    const reportText = generateWhatsAppReport(currentWorkDay);
    navigator.clipboard.writeText(reportText)
      .then(() => {
        setCopySuccess(true);
        triggerToast('📋 ¡Reporte copiado! Listo para pegar en WhatsApp.');
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(() => {
        triggerToast('❌ Error al copiar al portapapeles.');
      });
  };

  // Open WhatsApp with prefilled message
  const handleShareWhatsApp = () => {
    const reportText = generateWhatsAppReport(currentWorkDay);
    const encoded = encodeURIComponent(reportText);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Export all database activities to clean, analysis-ready CSV (with Excel UTF-8 support)
  const handleExportCSV = () => {
    try {
      const csvContent = generateCSV(workDays);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const fileDate = new Date().toISOString().split('T')[0];
      const fileName = `bitacora_calidad_control_${fileDate}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerToast('📥 ¡Datos exportados a CSV listos para análisis!');
    } catch (error) {
      console.error(error);
      triggerToast('❌ Error al exportar los datos.');
    }
  };

  // Change selected day by offset
  const shiftDate = (daysOffset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + daysOffset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Restore sample data if desired
  const handleResetSampleData = () => {
    if (window.confirm('¿Deseas restablecer los datos de ejemplo semanales? Tus registros actuales se combinarán.')) {
      const samples = getSampleData(personName);
      setWorkDays(prev => {
        // Merge samples into current without duplicating days
        const filteredPrev = prev.filter(p => !samples.some(s => s.date === p.date));
        return [...filteredPrev, ...samples].sort((a,b) => b.date.localeCompare(a.date));
      });
      triggerToast('🔄 Datos de ejemplo cargados.');
    }
  };

  // Compute calculated statistics for the last 7 calendar days (productive hours, excluding Pausa)
  const last7DaysStats = useMemo(() => {
    const result = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayData = workDays.find(wd => wd.date === dateStr && wd.personName === personName);
      let totalMins = 0;
      
      if (dayData && dayData.tasks.length > 0) {
        totalMins = dayData.tasks
          .filter(t => t.category !== 'Pausa')
          .reduce((sum, t) => sum + calculateDurationMinutes(t.startTime, t.endTime), 0);
      }
      
      result.push({
        date: dateStr,
        label: formatChartDate(dateStr),
        minutes: totalMins,
        hours: parseFloat((totalMins / 60).toFixed(1))
      });
    }
    return result;
  }, [workDays, personName]);

  // Compute category times across ALL logged data in workDays for the selected person
  const categoryStats = useMemo(() => {
    const totals: Record<string, number> = {
      'Inspección de Lote': 0,
      'Prueba de Laboratorio': 0,
      'Auditoría de Proceso': 0,
      'Gestión de No Conformidades': 0,
      'Calibración de Equipos': 0,
      'Elaboración de Reportes': 0,
      'Reunión': 0,
      'PIE Calidad': 0,
      'Gestión': 0,
      'SAP QM': 0,
      'Pausa': 0,
      'Otro': 0
    };
    
    let grandTotalMins = 0;
    let productiveMins = 0;
    
    workDays.filter(day => day.personName === personName).forEach(day => {
      day.tasks.forEach(task => {
        const mins = calculateDurationMinutes(task.startTime, task.endTime);
        const catKey = task.category === 'Otro' && task.customCategory ? task.customCategory : task.category;
        totals[catKey] = (totals[catKey] || 0) + mins;
        grandTotalMins += mins;
        if (task.category !== 'Pausa') {
          productiveMins += mins;
        }
      });
    });

    const list = Object.entries(totals).map(([cat, mins]) => {
      let pct = 0;
      if (cat !== 'Pausa') {
        pct = productiveMins > 0 ? Math.round((mins / productiveMins) * 100) : 0;
      }
      return {
        category: cat,
        minutes: mins,
        hours: parseFloat((mins / 60).toFixed(1)),
        percentage: pct,
        isPause: cat === 'Pausa'
      };
    });

    // Sort: normal categories first sorted by minutes, then Pausa at the end
    const nonPauseList = list.filter(item => !item.isPause).sort((a, b) => b.minutes - a.minutes);
    const pauseItem = list.find(item => item.isPause);
    
    const finalTotals = [...nonPauseList];
    if (pauseItem && pauseItem.minutes > 0) {
      finalTotals.push(pauseItem);
    }

    return {
      totals: finalTotals,
      grandTotalMins,
      productiveMins
    };
  }, [workDays, personName]);

  // Overall statistics summaries
  const totalHoursLoggedThisWeek = useMemo(() => {
    const sumMins = last7DaysStats.reduce((sum, d) => sum + d.minutes, 0);
    return (sumMins / 60).toFixed(1);
  }, [last7DaysStats]);

  const activeDaysCount = useMemo(() => {
    return last7DaysStats.filter(d => d.minutes > 0).length;
  }, [last7DaysStats]);

  // Calculate day totals for selected day (excluding Pausa from productive time)
  const selectedDayTotalMinutes = useMemo(() => {
    return sortedTasks
      .filter(t => t.category !== 'Pausa')
      .reduce((sum, t) => sum + calculateDurationMinutes(t.startTime, t.endTime), 0);
  }, [sortedTasks]);

  // Productivity Coach Message
  const productivityTip = useMemo(() => {
    const hasPausas = categoryStats.totals.find(c => c.category === 'Pausa')?.minutes || 0;
    const labMinutes = categoryStats.totals.find(c => c.category === 'Prueba de Laboratorio')?.minutes || 0;
    const deviationMinutes = categoryStats.totals.find(c => c.category === 'Gestión de No Conformidades')?.minutes || 0;
    
    if (workDays.length === 0) {
      return 'Empieza a registrar tus tareas de Control de Calidad para obtener consejos personalizados de organización y tiempos.';
    }
    
    if (deviationMinutes > 120) {
      return '⚠️ Gestión de Desviaciones: Has registrado bastante tiempo en "Gestión de No Conformidades". Te aconsejamos coordinar con los supervisores de línea para mitigar fallas recurrentes.';
    }
    
    if (hasPausas === 0 && selectedDayTotalMinutes > 240) {
      return '☕ Alerta de fatiga: No has registrado pausas hoy. Las tareas de inspección de alta precisión exigen descansar los ojos por lo menos 10 minutos cada 2 horas.';
    }
    
    if (labMinutes > 180) {
      return '🧪 Trabajo de Laboratorio: Llevas varias horas en pruebas analíticas de laboratorio. Asegura la correcta calibración de los durómetros y balanzas para proteger la validez de los resultados.';
    }
    
    return '🎯 Trazabilidad Asegurada: Registra cada inspección inmediatamente para mantener tu bitácora de Control de Calidad al día y lista para auditorías.';
  }, [categoryStats, selectedDayTotalMinutes, workDays]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 animate-bounce transition-all duration-300">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* LEFT SIDEBAR - Desktop Only */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col p-6 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Logo Brand Header */}
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-100">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Bitácora Laboral</h2>
              <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">Productividad & Tiempo</p>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              {personName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'JD'}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="relative">
                <select
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors focus:ring-0 outline-none p-0 cursor-pointer w-full font-sans"
                >
                  {COLLABORATORS.map(collab => (
                    <option key={collab} value={collab} className="bg-white text-slate-800">
                      {collab}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-wider">Colaborador</p>
            </div>
          </div>

          {/* Left Navigation Links */}
          <nav className="space-y-1">
            <div className="flex items-center space-x-2.5 p-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Registro Diario</span>
            </div>
            <a href="#weekly-analytics" className="flex items-center space-x-2.5 p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all">
              <BarChart2 className="w-4 h-4 text-slate-400" />
              <span>Métricas de Logro</span>
            </a>
            <a href="#whatsapp-preview" className="flex items-center space-x-2.5 p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Reportes de Copiado</span>
            </a>
            
            <button 
              onClick={handleExportCSV} 
              className="w-full flex items-center space-x-2.5 p-2.5 text-blue-700 bg-blue-50/40 hover:bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold transition-all mt-3 cursor-pointer group"
              title="Descargar toda la data limpia en formato CSV compatible con Excel"
            >
              <Download className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              <span>Exportar Excel (CSV)</span>
            </button>
          </nav>
        </div>

        {/* Weekly Progress Mini Widget */}
        <div className="pt-6 border-t border-slate-100">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">Progreso Semanal</p>
          <div className="flex items-end justify-between h-20 space-x-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
            {last7DaysStats.map((day) => {
              const maxHrs = 10;
              const pct = Math.min((day.hours / maxHrs) * 100, 100);
              const isSelected = day.date === selectedDate;
              return (
                <div 
                  key={day.date} 
                  className="flex-1 flex flex-col items-center group cursor-pointer h-full justify-end"
                  onClick={() => setSelectedDate(day.date)}
                  title={`${day.label}: ${day.hours}h`}
                >
                  <div className="w-full bg-slate-200 h-12 rounded-t-sm flex items-end overflow-hidden relative">
                    <div 
                      className={`w-full transition-all duration-300 rounded-t-sm ${isSelected ? 'bg-blue-600' : 'bg-blue-400 group-hover:bg-blue-500'}`} 
                      style={{ height: `${pct}%` }} 
                    />
                  </div>
                  <span className={`text-[8px] mt-1 font-bold leading-none ${isSelected ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
                    {day.label.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Lu - Do</span>
            <span>Histórico</span>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE - Responsive and clean */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Main Sticky Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div>
            <h1 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="hidden md:inline">Jornada de Trabajo</span>
              <span className="md:hidden font-extrabold text-blue-600">Bitácora Laboral</span>
              {/* Mobile name tag */}
              <select
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="md:hidden text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200 focus:ring-0 focus:outline-none cursor-pointer max-w-[130px] font-sans"
              >
                {COLLABORATORS.map(collab => (
                  <option key={collab} value={collab}>
                    {collab}
                  </option>
                ))}
              </select>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] md:text-xs font-bold rounded-lg border border-blue-200 animate-pulse">
                <Database className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="hidden sm:inline">Sincronizando con Supabase...</span>
                <span className="sm:hidden">Sincronizando...</span>
              </div>
            )}
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold rounded-lg border border-emerald-200" title="Todos tus datos están guardados en la nube de Supabase">
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Nube Sincronizada (Supabase)</span>
                <span className="sm:hidden">Sincronizado</span>
              </div>
            )}
            {(syncStatus === 'error' || syncStatus === 'not-configured') && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold rounded-lg border border-slate-200" title="La app funciona localmente en tu teléfono. El historial no se perderá al actualizar.">
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Modo Local (Dispositivo)</span>
              </div>
            )}

            {/* Sticky Header Quick Export Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-xs font-extrabold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
              title="Exportar toda la data recolectada a un archivo Excel/CSV limpio"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Excel/CSV</span>
              <span className="xs:hidden">Exportar</span>
            </button>
          </div>
        </header>

        {/* Content Body Grid */}
        <div className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 overflow-y-auto">
          
          {/* Left/Form Column - spans 5 on md and larger */}
          <div className="md:col-span-5 lg:col-span-4 space-y-5 flex flex-col justify-start">
            
            {/* Dynamic Date Selector */}
            <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <button onClick={() => shiftDate(-1)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">FECHA DE REGISTRO</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-extrabold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-center outline-none"
                />
              </div>

              <button onClick={() => shiftDate(1)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </section>

            {/* Registrar Nueva Tarea Card */}
            <section id="activity-form-container" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4Scroll">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="text-base text-blue-600">{editingTaskId ? '📝' : '⚡'}</span> 
                  {editingTaskId ? 'Editar Actividad' : 'Registrar Nueva Tarea'}
                </h3>
                {editingTaskId && (
                  <button 
                    type="button" 
                    onClick={handleCancelEdit}
                    className="text-[10px] text-red-500 hover:underline font-bold"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label htmlFor="task-title" className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    Nombre de la Actividad *
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    placeholder="Ej. Inspección de lote de materia prima entrante"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-slate-800 transition-colors"
                    required
                  />
                </div>

                {/* Category selectors */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                    Categoría
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(CATEGORY_COLORS) as TaskCategory[]).map((cat) => {
                      const item = CATEGORY_COLORS[cat];
                      const isSelected = taskCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setTaskCategory(cat)}
                          className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected 
                              ? `${item.bg} ${item.text} ${item.border} border-2 font-extrabold ring-1 ring-blue-300`
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>{item.emoji}</span>
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>

                  {taskCategory === 'Otro' && (
                    <div className="mt-2.5 transition-all">
                      <label htmlFor="custom-category" className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                        Nombre de Categoría Personalizada
                      </label>
                      <input
                        id="custom-category"
                        type="text"
                        placeholder="Ej. Limpieza de Área, Inducción, etc."
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-slate-800 transition-colors"
                        required={taskCategory === 'Otro'}
                      />
                    </div>
                  )}
                </div>

                {/* Time picker grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label htmlFor="start-time" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comienzo</label>
                      <button type="button" onClick={() => setQuickTime('start')} className="text-[9px] font-bold text-blue-600 hover:underline">Ahora</button>
                    </div>
                    <input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-400 focus:bg-white text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label htmlFor="end-time" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finalización</label>
                      <button type="button" onClick={() => setQuickTime('end')} className="text-[9px] font-bold text-blue-600 hover:underline">Ahora</button>
                    </div>
                    <input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-400 focus:bg-white text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Optional notes */}
                <div>
                  <label htmlFor="task-notes" className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                    Notas adicionales (opcional)
                  </label>
                  <input
                    id="task-notes"
                    type="text"
                    placeholder="Ej. Lote #8849 verificado sin desviaciones"
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs outline-none focus:border-blue-400 text-slate-800"
                  />
                </div>

                <div className="flex gap-2">
                  {editingTaskId && (
                    <button 
                      type="button" 
                      onClick={handleCancelEdit} 
                      className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-extrabold hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className={`py-3 text-white rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editingTaskId 
                        ? 'flex-1 bg-amber-600 shadow-amber-100 hover:bg-amber-700' 
                        : 'w-full bg-blue-600 shadow-blue-100 hover:bg-blue-700'
                    }`}
                  >
                    {editingTaskId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingTaskId ? 'Guardar Cambios' : 'Añadir al Registro'}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* High Density Theme Time Tracking Widget */}
            <section className="bg-blue-900 text-white p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-bold uppercase opacity-80 tracking-widest">Tiempo Productivo Hoy</h3>
                  <p className="text-3xl font-black mt-1.5 tracking-tight flex items-baseline">
                    {(() => {
                      const hrs = Math.floor(selectedDayTotalMinutes / 60);
                      const mins = selectedDayTotalMinutes % 60;
                      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                    })()}
                    <span className="text-lg font-normal opacity-50 ml-1">hrs</span>
                  </p>
                </div>
                <div className="bg-blue-800/80 p-2.5 rounded-xl text-lg">⌛</div>
              </div>
              
              {/* Miniature progress bar progress logic */}
              <div className="space-y-1.5">
                <div className="h-1.5 bg-blue-950/60 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-400 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((selectedDayTotalMinutes / dailyGoalMinutes) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] opacity-60 font-medium italic text-right">
                  {Math.round((selectedDayTotalMinutes / dailyGoalMinutes) * 100)}% de la meta diaria ({dailyGoalHours} hrs)
                </p>
              </div>
            </section>
            
          </div>

          {/* Right/List & Report Column - spans 7/8 on md and larger */}
          <div className="md:col-span-7 lg:col-span-8 space-y-5 flex flex-col justify-start">
            
            {/* Registered activities card */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-3.5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Tareas Registradas del Día
                </h3>
                <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
                  {sortedTasks.length} ITEMS
                </span>
              </div>

              {sortedTasks.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No hay tareas para esta fecha.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Usa el formulario para añadir actividades y medir tus tiempos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-200/50">
                      <tr>
                        <th className="px-4 py-3">Hora</th>
                        <th className="px-4 py-3">Actividad</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {sortedTasks.map((task) => {
                        const durationMins = calculateDurationMinutes(task.startTime, task.endTime);
                        const colors = CATEGORY_COLORS[task.category] || CATEGORY_COLORS['Otro'];
                        return (
                          <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono text-slate-500 font-medium whitespace-nowrap">
                              {task.startTime} - {task.endTime}
                              <span className="block text-[10px] text-slate-400 mt-0.5">({formatMinutes(durationMins)})</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-800">{task.title}</span>
                              {task.notes && (
                                <span className="block text-[11px] text-slate-500 italic mt-1 bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/40 w-fit">
                                  💡 {task.notes}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 w-fit ${colors.bg} ${colors.text} border ${colors.border}`}>
                                <span>{colors.emoji}</span>
                                <span>{task.category === 'Otro' && task.customCategory ? task.customCategory : task.category}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleStartEditTask(task)}
                                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* WhatsApp Preview Card */}
            <section id="whatsapp-preview" className="bg-emerald-50 rounded-2xl border-2 border-emerald-100 p-5 flex flex-col space-y-3 shadow-sm shrink-0">
              <div className="flex justify-between items-center shrink-0">
                <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-base">💬</span> Vista Previa Reporte WhatsApp
                </h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded-full hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1 shadow-sm shadow-emerald-100"
                  >
                    {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copySuccess ? 'COPIADO' : 'COPIAR TEXTO'}</span>
                  </button>
                  <button 
                    onClick={handleShareWhatsApp}
                    disabled={sortedTasks.length === 0}
                    className="px-4 py-1.5 bg-emerald-700 text-white text-[10px] font-extrabold rounded-full hover:bg-emerald-800 transition-colors cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-200 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Send className="w-3 h-3 text-white" />
                    <span>ENVIAR</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 font-mono text-[11.5px] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-all">
                {generateWhatsAppReport(currentWorkDay)}
              </div>
            </section>

            {/* Weekly Analytics tabbed charts */}
            <section id="weekly-analytics" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 shrink-0">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  Métricas de Logro Semanal
                </h3>
                
                {/* Stats quick summaries badge */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-bold leading-none">TOTAL HORAS</span>
                    <span className="text-xs font-extrabold text-slate-800 font-mono">{totalHoursLoggedThisWeek} hrs</span>
                  </div>
                  <div className="text-right border-l border-slate-100 pl-3">
                    <span className="text-[9px] text-slate-400 block font-bold leading-none">DÍAS ACTIVOS</span>
                    <span className="text-xs font-extrabold text-blue-600 font-mono">{activeDaysCount} / 7</span>
                  </div>
                </div>
              </div>

              {/* Tab options for charts */}
              <div className="flex border-b border-slate-100 text-xs shrink-0 bg-slate-50 p-1 rounded-xl">
                <button
                  onClick={() => setActiveChartTab('hours')}
                  className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'hours'
                      ? 'bg-white text-blue-700 shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Horas por Día
                </button>
                <button
                  onClick={() => setActiveChartTab('categories')}
                  className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'categories'
                      ? 'bg-white text-blue-700 shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Categorías %
                </button>
              </div>

              {/* Chart views */}
              <div className="py-1">
                
                {activeChartTab === 'hours' && (
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center items-center">
                      <svg className="w-full h-36" viewBox="0 0 300 120">
                        <line x1="30" y1="15" x2="280" y2="15" stroke="#F1F5F9" strokeDasharray="2 2" />
                        <line x1="30" y1="45" x2="280" y2="45" stroke="#F1F5F9" strokeDasharray="2 2" />
                        <line x1="30" y1="75" x2="280" y2="75" stroke="#F1F5F9" strokeDasharray="2 2" />
                        <line x1="30" y1="95" x2="280" y2="95" stroke="#E2E8F0" />

                        {last7DaysStats.map((day, i) => {
                          const barWidth = 20;
                          const gap = 12;
                          const startX = 35 + i * (barWidth + gap);
                          const maxVal = 10;
                          const value = day.hours;
                          const pctHeight = Math.min(value / maxVal, 1);
                          const barHeight = Math.max(pctHeight * 75, 2);
                          const startY = 95 - barHeight;
                          const isHovered = hoveredChartBar === day.date;
                          const isToday = day.date === selectedDate;

                          return (
                            <g 
                              key={day.date}
                              onMouseEnter={() => setHoveredChartBar(day.date)}
                              onMouseLeave={() => setHoveredChartBar(null)}
                              onClick={() => setSelectedDate(day.date)}
                              className="cursor-pointer"
                            >
                              <rect
                                x={startX}
                                y={startY}
                                width={barWidth}
                                height={barHeight}
                                rx="3"
                                fill={isToday ? '#2563EB' : isHovered ? '#3B82F6' : '#93C5FD'}
                                className="transition-all duration-200"
                              />
                              <text
                                x={startX + barWidth / 2}
                                y="107"
                                textAnchor="middle"
                                fill={isToday ? '#2563EB' : '#64748B'}
                                fontSize="7"
                                fontWeight={isToday ? 'bold' : 'normal'}
                              >
                                {day.label}
                              </text>
                              {isHovered && (
                                <g>
                                  <rect x={startX - 12} y={startY - 18} width="44" height="14" rx="3" fill="#1E293B" />
                                  <text x={startX + 10} y={startY - 8} textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">
                                    {day.hours}h
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                )}

                {activeChartTab === 'categories' && (
                  <div className="space-y-2">
                    {categoryStats.grandTotalMins === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">No hay datos de distribución.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {categoryStats.totals.map((stat) => {
                          if (stat.minutes === 0) return null;
                          const colors = CATEGORY_COLORS[stat.category as TaskCategory] || CATEGORY_COLORS['Otro'];
                          const isPause = stat.category === 'Pausa';
                          return (
                            <div key={stat.category} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                                <span className="flex items-center gap-1">
                                  <span>{colors.emoji}</span>
                                  <span>{stat.category}</span>
                                </span>
                                <span className="font-mono text-slate-500">
                                  {stat.hours}h {isPause ? '' : `(${stat.percentage}%)`}
                                </span>
                              </div>
                              {!isPause && (
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${colors.accent}`} style={{ width: `${stat.percentage}%` }} />
                                </div>
                              )}
                              {isPause && (
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 border-dashed" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
              </div>

              {/* Advice panel */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 flex gap-2.5 items-start">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-blue-800 tracking-wider uppercase block">Asesor de Productividad</span>
                  <p className="text-xs text-blue-900 leading-relaxed font-semibold">
                    {productivityTip}
                  </p>
                </div>
              </div>
            </section>
          </div>

        </div>

        {/* Small Footer bar */}
        <footer className="h-10 border-t border-slate-200/60 bg-white flex items-center justify-center text-[10px] text-slate-400 font-medium px-4 shrink-0">
          <span>Bitácora de Productividad Laboral v1.2 • Guardado local con localStorage</span>
        </footer>

      </main>
    </div>
  );
}
