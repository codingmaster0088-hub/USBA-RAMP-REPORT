export interface DelayCodeGroup {
  category: string;
  codes: string[];
}

export const DELAY_CODES: DelayCodeGroup[] = [
  {
    category: '1 - Passenger / Baggage',
    codes: [
      '11: Late check-in, acceptance of passengers after deadline',
      '12: Late Check-in, congestion in check-in area',
      '13: Check-in error',
      '14: Overbooking, booking errors',
      '15: Boarding, discrepancies and paging, missing checked-in passenger at gate',
      '16: Commercial Publicity, Passenger Convenience, VIP, Press, Ground meals and missing personal items',
      '17: Catering order, late or incorrect order given to supplier',
      '18: Baggage processing, sorting, etc.'
    ]
  },
  {
    category: '2 - Cargo / Mail',
    codes: [
      '21: Documentation, errors, etc.',
      '22: Late positioning',
      '23: Late acceptance',
      '24: Inadequate packing',
      '25: Overbooking, booking errors',
      '26: Late preparation in warehouse',
      '27: Mail Over sales, packing, etc.',
      '28: Mail late positioning',
      '29: Mail late acceptance'
    ]
  },
  {
    category: '3 - Handling',
    codes: [
      '31: Aircraft documentation late or inaccurate, weight and balance (Load sheet), general declaration, passenger manifest, etc.',
      '32: Loading, Unloading, bulky/special load, cabin load, lack of loading staff',
      '33: Loading Equipment, lack of or breakdown, e.g. container pallet loader, lack of staff',
      '34: Servicing Equipment, lack of or breakdown, lack of staff, e.g. steps',
      '35: Aircraft Cleaning',
      '36: Fueling, Defueling, fuel supplier',
      '37: Catering, late delivery or loading',
      '38: ULD, Containers, pallets, lack of or breakdown',
      '39: Technical equipment, lack of or breakdown, lack of staff, e.g., pushback'
    ]
  },
  {
    category: '4 - Technical',
    codes: [
      '41: Aircraft defects',
      '42: Scheduled maintenance, late release',
      '43: Non-scheduled maintenance, special checks and / or additional works beyond normal maintenance',
      '44: Spares and maintenance equipment, lack of or breakdown',
      '45: AOG (Aircraft on ground for technical reasons) Spares, to be carried to another station',
      '46: Aircraft change for technical reasons',
      '47: Standby aircraft, lack of planned standby aircraft for technical reasons',
      '48: Scheduled cabin configuration and version adjustment'
    ]
  },
  {
    category: '5 - Damage / Failure',
    codes: [
      '51: Damage during flight operations, bird or lightning strike, turbulence, heavy or overweight landing',
      '52: Damage during ground operations, collisions (other than during taxiing, loading/offloading damage, contamination, towing, extreme weather conditions)',
      '55: Departure Control System, Check-in, weight and balance (load control), computer system error, baggage sorting, gate-reader error or problems',
      '56: Cargo preparation/documentation system',
      '57: Flight plans',
      '58: Other computer systems'
    ]
  },
  {
    category: '6 - Operation',
    codes: [
      '61: Flight plan, late completion or change of flight documentation',
      '62: Operational requirements, fuel, load alteration',
      '63: Late crew boarding or departure procedures',
      '64: Flight deck crew shortage, Crew rest',
      '65: Flight deck crew special request or error',
      '66: Late cabin crew boarding or departure procedures',
      '67: Cabin crew shortage',
      '68: Cabin crew error or special request',
      '69: Captain request for security check, extraordinary'
    ]
  },
  {
    category: '7 - Weather',
    codes: [
      '71: Departure station',
      '72: Destination station',
      '73: Enroute or Alternate',
      '75: De-Icing of aircraft, removal of ice/snow, frost prevention',
      '76: Removal of snow/ice/water/sand from airport/runway',
      '77: Aircraft ground handling impaired by adverse weather conditions'
    ]
  },
  {
    category: '8 - Air Traffic Control (ATC)',
    codes: [
      '81: ATC restriction en-route or capacity',
      '82: ATC restriction due to staff shortage or equipment failure en-route',
      '83: ATC restriction at destination',
      '84: ATC restriction due to weather at destination',
      '85: Mandatory security',
      '86: Immigration, Customs, Health',
      '87: Airport Facilities, parking stands, ramp congestion, buildings, gate limitations, ...',
      '88: Restrictions at airport of destination, airport/runway closed due obstruction, industrial action, staff shortage, political unrest, noise abatement, night curfew, special flights, ...',
      '89: Restrictions at airport of departure, airport/runway closed due obstruction, industrial action, staff shortage, political unrest, noise abatement, night curfew, special flights, start-up and pushback, ...'
    ]
  },
  {
    category: '9 - Miscellaneous',
    codes: [
      '91: Passenger or Load Connection, awaiting load or passengers from another flight. Protection of stranded passengers onto a new flight.',
      '92: Through Check-in error, passenger and baggage',
      '93: Aircraft rotation',
      '94: Cabin crew rotation',
      '95: Crew rotation (entire or cockpit crew)',
      '96: Operations control, rerouting, diversion, consolidation, aircraft change for reasons other than technical',
      '97: Industrial action within own airline',
      '98: Industrial action outside own airline',
      '99: Miscellaneous, not elsewhere specified'
    ]
  }
];
