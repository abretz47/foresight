import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import reducer from './reducer';
import Login from './src/pages/Login';
import HomeScreen from './src/pages/HomeScreen';
import ShotProfile from './src/pages/ShotProfile';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen';
import Default from './src/pages/Default';
import HowToUse from './src/pages/HowToUse';
import { COLORS } from './src/styles/styles';

const store = createStore(reducer);
const Stack = createStackNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.primary,
    text: COLORS.textLight,
    border: 'transparent',
    primary: COLORS.accent,
    notification: COLORS.accent,
  },
};

const headerStyle = {
  backgroundColor: COLORS.primary,
  elevation: 0,
  shadowOpacity: 0,
  borderBottomWidth: 0,
};

const headerTitleStyle = {
  color: COLORS.textLight,
  fontWeight: '700' as const,
  fontSize: 18,
  letterSpacing: 0.3,
};

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer theme={NavTheme}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle,
            headerTitleStyle,
            headerTintColor: COLORS.textLight,
          }}
        >
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Foresight', headerLeft: () => null }}
          />
          <Stack.Screen name="ShotProfile" component={ShotProfile} options={{ title: 'Shot Profile' }} />
          <Stack.Screen
            name="RecordDetails"
            component={RecordDetailsScreen}
            options={{ title: 'Shot Selection' }}
          />
          <Stack.Screen name="Analyze" component={Record} options={{ title: 'Analyze' }} />
          <Stack.Screen name="Record" component={Record} options={{ title: 'Record' }} />
          <Stack.Screen name="HowToUse" component={HowToUse} options={{ title: 'How To Use' }} />
          <Stack.Screen name="Default" component={Default} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}
