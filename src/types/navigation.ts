import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Login: undefined;
  Home: { user: string };
  ShotProfile: { user: string; selectedClubId?: string };
  RecordDetails: { calledFrom: string; user: string };
  Analyze: {
    user: string;
    id: string;
    shotName: string;
    targetDistance: string;
    targetRadius: string;
    missRadius: string;
    calledFrom: string;
  };
  Record: {
    user: string;
    id: string;
    shotName: string;
    targetDistance: string;
    targetRadius: string;
    missRadius: string;
    calledFrom: string;
  };
  Default: undefined;
  HowToUse: undefined;
  ShotDetails: {
    user: string;
    clubId: string;
    clubName: string;
  };
};

export type LoginNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;
export type LoginRouteProp = RouteProp<RootStackParamList, 'Login'>;

export type HomeNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type HomeRouteProp = RouteProp<RootStackParamList, 'Home'>;

export type ShotProfileNavigationProp = StackNavigationProp<RootStackParamList, 'ShotProfile'>;
export type ShotProfileRouteProp = RouteProp<RootStackParamList, 'ShotProfile'>;

export type RecordDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'RecordDetails'>;
export type RecordDetailsRouteProp = RouteProp<RootStackParamList, 'RecordDetails'>;

export type RecordNavigationProp = StackNavigationProp<RootStackParamList, 'Record'>;
export type RecordRouteProp = RouteProp<RootStackParamList, 'Record'>;

export type ShotDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'ShotDetails'>;
export type ShotDetailsRouteProp = RouteProp<RootStackParamList, 'ShotDetails'>;
