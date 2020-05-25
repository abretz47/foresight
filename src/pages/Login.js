import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import * as Facebook from 'expo-facebook';
import {connect } from 'react-redux';
import {getUser} from '../../reducer.js'

import {styles} from '../styles/styles.js';

import app from '../../app.json'

async function initLogin(navigate) {
  try {
    await Facebook.initializeAsync(app.facebook.id, app.facebook.name);
    const {
      type,
      token,
      expires,
      permissions,
      declinedPermissions,
    } = await Facebook.logInWithReadPermissionsAsync(app.facebook.id, {
      permissions: ['public_profile'],
      behavior: 'browser'
    });
    if (type === 'success') {
      // Get the user's name using Facebook's Graph API
      const response = await fetch(`https://graph.facebook.com/me?access_token=${token}`);
      const user = await response.json()
      navigate("Home",{user:user.id});
    } else {
      // type === 'cancel'
    }
  } catch ({ message }) {
    alert(`Facebook Login Error: ${message}`);
    navigate("Login");
  }
}

class Login extends Component {
    static navigationOptions = {
    title: 'Login',
  };
  componentDidMount() {
    this.props.getUser();
  }
  render() {
    const { user } = this.props;
    initLogin(this.props.navigation.navigate);
    return (
      <View style={styles.template}>
        <View style={styles.homeContainer}>
          <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
                <Button title="Login" onPress={() => this.forceUpdate()} color="black"/>
            </View>
          </View>
        </View>
      </View>
    );
  }
}
const mapStateToProps = ({ user}) => ({
  user
});

const mapDispatchToProps = {
  getUser
};

export default connect(mapStateToProps, mapDispatchToProps)(Login);

