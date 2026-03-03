import React, { Component } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { styles } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

export default class HomeScreen extends Component<Props> {
  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);
  }

  navigateToRecord = (calledFrom: 'Record' | 'Analyze') => {
    const user = this.props.route.params?.user ?? 'local_user';
    const { navigate } = this.props.navigation;
    let navigated = false;
    const promise = DB.getShotProfile(user, (shots) => {
      navigated = true;
      const firstShot = shots[0];
      navigate(calledFrom, {
        user,
        id: firstShot.id,
        shotName: firstShot.name,
        targetDistance: firstShot.distance,
        targetRadius: firstShot.targetRadius,
        missRadius: firstShot.missRadius,
        calledFrom,
      });
    });
    void promise.then(() => {
      if (!navigated) {
        Alert.alert(
          'No Shot Profiles Found',
          'Please create at least one shot profile before recording or analyzing data.',
          [{ text: 'Go to Shot Profile', onPress: () => navigate('ShotProfile', { user }) }, { text: 'Cancel', style: 'cancel' }]
        );
      }
    });
  };

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    return (
      <View style={styles.template}>
        <View style={styles.homeContainer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => navigate('ShotProfile', { user })}>
              <Text style={styles.buttonLabel}>Shot Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => this.navigateToRecord('Record')}>
              <Text style={styles.buttonLabel}>Record Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonContainer} onPress={() => this.navigateToRecord('Analyze')}>
              <Text style={styles.buttonLabel}>Analyze Data</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logoutButtonRow}>
            <TouchableOpacity style={styles.logoutButtonContainer} onPress={() => navigate('Login')}>
              <Text style={styles.buttonLabel}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
}
