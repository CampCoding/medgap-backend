function getDatesForDayBetween(startDate, endDate, daySlug) {
    
    const dayMap = {
      Sun: 0, Sunday: 0,
      Mon: 1, Monday: 1,
      Tue: 2, Tuesday: 2,
      Wed: 3, Wednesday: 3,
      Thu: 4, Thursday: 4,
      Fri: 5, Friday: 5,
      Sat: 6, Saturday: 6,
    };
    const targetDay = dayMap[daySlug];
    if (typeof targetDay !== 'number') return [];
  
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      if (dt.getDay() === targetDay) {
        dates.push(dt.toISOString().split('T')[0]);
      }
    }
    return dates;
  }

  function getDatesBetweenOld(startDate, endDate, opts = {}) {
    const {
      locale = 'en-US',
      timeZone = 'Africa/Cairo', 
    } = opts;
  
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) return [];
  
    const dates = [];
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone });
    
    const ymdFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push({
        date: ymdFmt.format(d),       
        day: dayFmt.format(d),        
      });
    }
    return dates;
  }
  function getDatesBetween(startDate, endDate, targetDays, opts = {}) {
    const {
      locale = 'en-US',
      timeZone = 'Africa/Cairo',
      returnShortDay = false, 
    } = opts;
  
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) return [];
  
    const allow = new Set(
      (targetDays || []).map(d => String(d).slice(0, 3).toLowerCase())
    );
  
    const dayLongFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone });
    const dayShortFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone });
    const ymdFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const short = dayShortFmt.format(d); 
      if (allow.has(short.toLowerCase())) {
        out.push({
          date: ymdFmt.format(d),                 
          day: returnShortDay ? short : dayLongFmt.format(d), 
        });
      }
    }
    return out;
  }
  

  module.exports = { getDatesForDayBetween, getDatesBetween };