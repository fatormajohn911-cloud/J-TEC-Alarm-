import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleRoutine } from '../types/schedule';
import { storageService } from '../services/storageService';

export function useSchedule() {
  const [routines, setRoutines] = useState<ScheduleRoutine[]>(() => storageService.getSchedule());
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay()); // 0 = Sun

  useEffect(() => {
    storageService.saveSchedule(routines);
  }, [routines]);

  const routinesForSelectedDay = useMemo(() => {
    return routines
      .filter((r) => r.dayOfWeek === selectedDay)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [routines, selectedDay]);

  const toggleRoutine = useCallback((id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
  }, []);

  const addRoutine = useCallback((routine: Omit<ScheduleRoutine, 'id'>) => {
    const newRoutine: ScheduleRoutine = {
      ...routine,
      id: `routine_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    setRoutines((prev) => [...prev, newRoutine]);
    return newRoutine;
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    routines,
    selectedDay,
    setSelectedDay,
    routinesForSelectedDay,
    toggleRoutine,
    addRoutine,
    deleteRoutine,
  };
}
