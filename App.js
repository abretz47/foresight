import React, {Component} from 'react';
import {View} from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import { createStore, applyMiddleware } from 'redux';
import { Provider, connect } from 'react-redux';
import reducer from './reducer.js'

import Login from './src/pages/Login';
import HomeScreen from './src/pages/HomeScreen';
import ShotProfile from './src/pages/ShotProfile';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen';
import Default from './src/pages/Default';


//Issue with Firebase module -- Found here: https://stackoverflow.com/questions/60361519/cant-find-a-variable-atob
import {decode, encode} from 'base-64'

if (!global.btoa) {  global.btoa = encode }

if (!global.atob) { global.atob = decode }
//----------------------------------------------------------------------------------------------------------------

const store = createStore(reducer);

const MainNavigator = createStackNavigator({
  Login: {screen: Login},
  Home: {screen: HomeScreen},
  ShotProfile: {screen: ShotProfile},
  RecordDetails: {screen:RecordDetailsScreen},
  Analyze: {screen:Record},
  Record: {screen: Record},
  Default:{screen:Default}
});
const AppContainer = createAppContainer(MainNavigator);

export default class App extends Component {

  render() {
    return(
      <Provider store={store}>< AppContainer /></Provider>
      
    )
  }
}
