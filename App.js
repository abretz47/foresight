import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { createStore } from 'redux';
import { Provider } from 'react-redux';
import reducer from './reducer.js';

import Login from './src/pages/Login';
import HomeScreen from './src/pages/HomeScreen';
import ShotProfile from './src/pages/ShotProfile';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen';
import Default from './src/pages/Default';

const store = createStore(reducer);
const Stack = createStackNavigator();

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={Login} options={{ title: 'Login' }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Welcome', headerLeft: () => null }} />
          <Stack.Screen name="ShotProfile" component={ShotProfile} options={{ title: 'Shot Profile' }} />
          <Stack.Screen name="RecordDetails" component={RecordDetailsScreen} options={{ title: 'Shot Selection' }} />
          <Stack.Screen name="Analyze" component={Record} options={{ title: 'Analyze' }} />
          <Stack.Screen name="Record" component={Record} options={{ title: 'Record' }} />
          <Stack.Screen name="Default" component={Default} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}

