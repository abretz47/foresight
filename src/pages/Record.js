import React, {Component} from 'react';
import {TouchableOpacity,TouchableHighlight, Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';
import { styles } from '../styles/styles';

export default class Record extends Component{
  render(){
      const { navigation } = this.props;
      const club = navigation.getParam('club','No club');
      const target = navigation.getParam('target', 'No target');
      const targetRadius = navigation.getParam('targetRadius', "No target radius");
      const missRadius = navigation.getParam('missRadius', "No miss radisu");
      return(
        <View style={styles.template}>
          <View style={styles.touchableContainer}>
            <View style={styles.row}>
              <TouchableOpacity
                style={{
                  borderWidth:1,
                  borderColor:'rgba(0,0,0,0.2)',
                  width:280,
                  height:280,
                  backgroundColor:'#fff',
                  borderRadius:140,
                }}
                onPress={(evt) => {console.log(evt.nativeEvent.pageX)}}
              >
              <View style={styles.touchableContainer}>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={{
                      borderWidth:1,
                      borderColor:'rgba(0,0,0,0.2)',
                      width:80,
                      height:80,
                      backgroundColor:'red',
                      borderRadius:40,
                    }}
                    onPress={(evt) => {console.log(evt.nativeEvent.pageX)}}
                  >
                  </TouchableOpacity>
                </View>
              </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
  }
}