import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import TrainingModuleHost from '../components/TrainingModuleHost';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'TrainingModule'>;
}

export default function TrainingModule({ navigation, route }: Props) {
  return (
    <TrainingModuleHost
      navigation={navigation}
      user={route.params.user}
      slug={route.params.slug}
      componentKey={route.params.componentKey}
    />
  );
}
