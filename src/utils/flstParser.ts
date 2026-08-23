import { ScheduleFlight } from '../types';

/**
 * Parses raw FLST data pasted by Admin.
 * Example line:
 * '6 BS 101 DAC CGP 01AUG 07:00 AM 07:00 AT7 S2-AKJ OK SO 71'
 */
export function parseFLSTData(rawText: string): { flights: ScheduleFlight[]; dateHeader: string } {
  if (!rawText || !rawText.trim()) {
    return { flights: [], dateHeader: '' };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const flights: ScheduleFlight[] = [];
  let detectedDate = '';

  lines.forEach((line, index) => {
    // 1. Flight Number
    let flightNum = '';
    const bsMatch = line.match(/BS\s*[-]?\s*(\d{2,4})/i);
    if (bsMatch) {
      flightNum = bsMatch[1];
    } else {
      const numMatch = line.match(/\b(\d{2,4})\b/);
      if (numMatch) {
        flightNum = numMatch[1];
      }
    }

    if (!flightNum) return; // Skip line if no valid flight number

    const flightInt = parseInt(flightNum, 10);
    // Odd numbers flight = DEPARTURE, Even numbers flight = ARRIVAL
    const isDeparture = flightInt % 2 !== 0;

    // 2. Date e.g. 23AUG, 01AUG, 22AUG or 23AUG26
    const dateMatch = line.match(/\b(\d{1,2})\s*([A-Za-z]{3})(?:[\s-]?((?:20)?2[4-9]|(?:20)?3[0-9]))?\b/i);
    let dateStr = '';
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].toUpperCase();
      const yr = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : '';
      dateStr = yr ? `${day} ${month} ${yr.slice(-2)}` : `${day} ${month}`;
      if (!detectedDate) {
        detectedDate = dateStr;
      }
    }

    // 3. Sector / Station
    let sector = 'CGP';
    // Look for airport IATA pairs like DAC CGP or standalone codes
    const stationMatches = line.match(/\b(DAC|CGP|SPD|CXB|ZYL|JSR|RJH|BZL|KTM|SIN|BKK|KUL|DOH|DXB|MCT|CAN|CCU|JED|RUH|MAA)\b/gi);
    if (stationMatches && stationMatches.length > 0) {
      if (stationMatches.length >= 2) {
        // Take the second station or the non-DAC one
        const secondary = stationMatches.find((s) => s.toUpperCase() !== 'DAC');
        sector = secondary ? secondary.toUpperCase() : stationMatches[1].toUpperCase();
      } else {
        sector = stationMatches[0].toUpperCase();
      }
    }

    // 4. Time e.g. 07:00
    let timeStr = '07:00';
    const timeMatch = line.match(/\b(\d{1,2}:\d{2}(?:\s*[AP]M)?)\b/i);
    if (timeMatch) {
      timeStr = timeMatch[1].toUpperCase();
    } else {
      // Look for 4 digits like 0700
      const altTime = line.match(/\b([012]\d[05]\d)\b/);
      if (altTime) {
        timeStr = `${altTime[1].slice(0, 2)}:${altTime[1].slice(2)}`;
      }
    }

    // 5. Aircraft Registration e.g. S2-AKJ
    let aircraft = 'S2-AKJ';
    const acMatch = line.match(/\b(S2-[A-Z0-9]{3}|[A-Z0-9]{2,3}-[A-Z0-9]{3})\b/i);
    if (acMatch) {
      aircraft = acMatch[1].toUpperCase();
    } else {
      // Look for S2AKJ or AKJ
      const regAlt = line.match(/\bS2([A-Z]{3})\b/i);
      if (regAlt) {
        aircraft = `S2-${regAlt[1].toUpperCase()}`;
      }
    }

    // 6. Passenger Load e.g. 71
    let paxLoad = '0';
    const soMatch = line.match(/(?:SO|OK|PAX|LOAD)\s*(\d{1,3})/i);
    if (soMatch) {
      paxLoad = soMatch[1];
    } else {
      // Check last numeric token in line
      const endNumMatch = line.match(/(\d{1,3})\s*$/);
      if (endNumMatch) {
        paxLoad = endNumMatch[1];
      }
    }

    const flightFull = `BS-${flightNum}`;
    const formattedDisplay = `BS-${flightNum}-${sector}-${aircraft}-${paxLoad}-${timeStr}`;

    flights.push({
      id: `flst-${Date.now()}-${index}`,
      flightNum,
      flightFull,
      sector,
      dateStr: dateStr || 'TODAY',
      timeStr,
      aircraft,
      paxLoad,
      isDeparture,
      formattedDisplay,
      rawLine: line
    });
  });

  return {
    flights,
    dateHeader: detectedDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
  };
}

export const sampleFLSTInput = `6 BS 101 DAC CGP 01AUG 07:00 AM 07:00 AT7 S2-AKJ OK SO 71
6 BS 102 CGP DAC 01AUG 08:30 AM 08:30 AT7 S2-AKJ OK SO 68
6 BS 151 DAC JSR 01AUG 09:15 AM 09:15 AT7 S2-AKM OK SO 72
6 BS 152 JSR DAC 01AUG 10:40 AM 10:40 AT7 S2-AKM OK SO 65
6 BS 119 DAC CXB 01AUG 11:30 AM 11:30 AT7 S2-AKN OK SO 74
6 BS 120 CXB DAC 01AUG 01:10 PM 13:10 AT7 S2-AKN OK SO 70
6 BS 341 DAC ZYL 01AUG 02:20 PM 14:20 AT7 S2-AKL OK SO 69
6 BS 342 ZYL DAC 01AUG 03:45 PM 15:45 AT7 S2-AKL OK SO 73
6 BS 307 DAC SIN 01AUG 04:30 PM 16:30 B737 S2-AJA OK SO 154
6 BS 308 SIN DAC 01AUG 05:55 PM 17:55 B737 S2-AJA OK SO 148
6 BS 325 DAC RJH 01AUG 06:40 PM 18:40 AT7 S2-AKP OK SO 66
6 BS 326 RJH DAC 01AUG 08:05 PM 20:05 AT7 S2-AKP OK SO 64`;
