import { useState, useEffect } from 'react';

export interface ClockState {
  time24: string; // "14:05"
  time12: string; // "02:05"
  hours: string;
  minutes: string;
  seconds: string;
  period: 'AM' | 'PM';
  dateFormatted: string; // "Tuesday, Nov 11"
  greeting: string;
  timestamp: number;
}

export function useClock(timeFormat24h = false): ClockState {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hoursNum = now.getHours();
  const minutesNum = now.getMinutes();
  const secondsNum = now.getSeconds();

  const hours24 = hoursNum.toString().padStart(2, '0');
  const minutes = minutesNum.toString().padStart(2, '0');
  const seconds = secondsNum.toString().padStart(2, '0');

  const period: 'AM' | 'PM' = hoursNum >= 12 ? 'PM' : 'AM';
  const hours12Num = hoursNum % 12 || 12;
  const hours12 = hours12Num.toString().padStart(2, '0');

  const displayHours = timeFormat24h ? hours24 : hours12;

  let greeting = 'Good evening';
  if (hoursNum >= 5 && hoursNum < 12) {
    greeting = 'Good morning';
  } else if (hoursNum >= 12 && hoursNum < 17) {
    greeting = 'Good afternoon';
  } else if (hoursNum >= 17 && hoursNum < 22) {
    greeting = 'Good evening';
  } else {
    greeting = 'Rest well tonight';
  }

  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return {
    time24: `${hours24}:${minutes}`,
    time12: `${hours12}:${minutes}`,
    hours: displayHours,
    minutes,
    seconds,
    period,
    dateFormatted,
    greeting,
    timestamp: now.getTime(),
  };
}
