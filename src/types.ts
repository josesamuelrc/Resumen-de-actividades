/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskCategory = 
  | 'Inspección de Lote' 
  | 'Prueba de Laboratorio' 
  | 'Auditoría de Proceso' 
  | 'Gestión de No Conformidades' 
  | 'Calibración de Equipos' 
  | 'Elaboración de Reportes' 
  | 'Pausa' 
  | 'Otro';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  customCategory?: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  notes?: string;
}

export interface WorkDay {
  date: string; // YYYY-MM-DD
  personName: string;
  tasks: Task[];
}

export const CATEGORY_COLORS: Record<TaskCategory, { bg: string; text: string; border: string; accent: string; emoji: string }> = {
  'Inspección de Lote': {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-100 dark:border-blue-900/50',
    accent: 'bg-blue-600',
    emoji: '📦'
  },
  'Prueba de Laboratorio': {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-100 dark:border-indigo-900/50',
    accent: 'bg-indigo-600',
    emoji: '🧪'
  },
  'Auditoría de Proceso': {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-100 dark:border-teal-900/50',
    accent: 'bg-teal-500',
    emoji: '📋'
  },
  'Gestión de No Conformidades': {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-100 dark:border-amber-900/50',
    accent: 'bg-amber-500',
    emoji: '⚠️'
  },
  'Calibración de Equipos': {
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-100 dark:border-pink-900/50',
    accent: 'bg-pink-500',
    emoji: '⚙️'
  },
  'Elaboración de Reportes': {
    bg: 'bg-slate-50 dark:bg-slate-950/40',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-100 dark:border-slate-900/50',
    accent: 'bg-slate-500',
    emoji: '📑'
  },
  Pausa: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    accent: 'bg-emerald-500',
    emoji: '☕'
  },
  Otro: {
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-100 dark:border-gray-700/50',
    accent: 'bg-gray-500',
    emoji: '📝'
  }
};
