export interface DefaultShotProfile {
  name: string;
  distance: string;
  targetRadius: string;
  missRadius: string;
}

const defaultShotProfiles: DefaultShotProfile[] = [
  { name: 'Driver', distance: '250', targetRadius: '15', missRadius: '50' },
  { name: '3 Wood', distance: '220', targetRadius: '14', missRadius: '40' },
  { name: '5 Wood', distance: '210', targetRadius: '13', missRadius: '35' },
  { name: '3 Iron', distance: '200', targetRadius: '12', missRadius: '35' },
  { name: '4 Iron', distance: '190', targetRadius: '11', missRadius: '35' },
  { name: '5 Iron', distance: '180', targetRadius: '10', missRadius: '30' },
  { name: '6 Iron', distance: '170', targetRadius: '9', missRadius: '25' },
  { name: '7 Iron', distance: '155', targetRadius: '8', missRadius: '25' },
  { name: '8 Iron', distance: '130', targetRadius: '7', missRadius: '20' },
  { name: '9 Iron', distance: '120', targetRadius: '6', missRadius: '20' },
  { name: 'PW', distance: '110', targetRadius: '5', missRadius: '15' },
  { name: 'SW', distance: '80', targetRadius: '4', missRadius: '15' },
];

export default defaultShotProfiles;
