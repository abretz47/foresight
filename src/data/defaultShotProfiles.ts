export interface DefaultShotProfile {
  name: string;
  distance: string;
  targetRadius: string;
  missRadius: string;
}

const defaultShotProfiles: DefaultShotProfile[] = [
  { name: 'Driver', distance: '250', targetRadius: '15', missRadius: '50' },
  { name: '3 Wood', distance: '220', targetRadius: '12', missRadius: '40' },
  { name: '5 Iron', distance: '180', targetRadius: '10', missRadius: '30' },
  { name: '7 Iron', distance: '155', targetRadius: '8', missRadius: '25' },
  { name: '9 Iron', distance: '130', targetRadius: '7', missRadius: '20' },
  { name: 'Pitching Wedge', distance: '110', targetRadius: '6', missRadius: '18' },
  { name: 'Sand Wedge', distance: '80', targetRadius: '5', missRadius: '15' },
];

export default defaultShotProfiles;
