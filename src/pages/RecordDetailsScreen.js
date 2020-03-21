import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button, Picker } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import {styles} from '../styles/styles.js';
import * as DB from '../data/db';

export default class RecordDetailsScreen extends Component{
    static navigationOptions = {
        title: 'Shot Selection',
      };
    constructor(props){
        super(props);
        //const { navigation } = this.props;
        this.state = {selectedShot:this.props.defaultSelection, 
          shots:[],
          id:"",
          shotName:"",
          targetDistance:"",
          targetRadius:"",
          missRadius:""
        };
    }
    componentDidMount() {
      const { navigation } = this.props;
      this.focusListener = navigation.addListener('didFocus', () => {
        // The screen is focused
        this.getShotProfile();
        });
    }
    componentWillUnmount() {
      // Remove the event listener
      this.focusListener.remove();
    }
    selectionChange = (index) => {
      var selection = this.state.shots[index];
      this.setState({id: selection.id,
        shotName: selection.name,
        targetDistance: selection.distance, 
        targetRadius: selection.targetRadius, 
        missRadius: selection.missRadius})
  }
    getShotProfile = () => {
      DB.getShotProfile((data) => {
        this.setState({shots:data,selectedShot:0}, () => {
          this.selectionChange(0);
        });
        
        });
    }
      render() {
        const {navigate} = this.props.navigation;
        return (
          <View style={styles.template}>
            <View style={styles.container}>
              <View style={styles.row}>
                  <View style={styles.column}>
                  <Text style={styles.label}>Select Shot Type</Text>
                      <Picker 
                          selectedValue={this.state.selectedShot}
                          mode="dialog"
                          onValueChange={(itemValue, itemIndex) => {
                              this.setState({selectedShot: itemValue});
                              this.selectionChange(itemValue,itemIndex);
                          }
                          }>
                          {Object.keys(this.state.shots).map((key) => {
                            return (<Picker.Item label={this.state.shots[key].name} value={key} key={key}/>) //if you have a bunch of keys value pair
                          })}
                      </Picker>
                  </View>
              </View>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Shot Name</Text>
                  <Text>{this.state.shotName}</Text>
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Target Distance</Text>
                  <Text>{this.state.targetDistance}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Target Radius</Text>
                  <Text>{this.state.targetRadius}</Text>
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Miss Radius</Text>
                  <Text>{this.state.missRadius}</Text>
                </View>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <View style={styles.buttonContainer}>
                <Button title="Go!" color="black" onPress={() => {
                  var calledFrom = this.props.navigation.getParam("calledFrom", "Default");
                    this.props.navigation.navigate(calledFrom,{
                      id: this.state.id,
                      shotName: this.state.shotName,
                      targetDistance: this.state.targetDistance,
                      targetRadius: this.state.targetRadius,
                      missRadius: this.state.missRadius,
                      calledFrom: calledFrom
                    });
                  }}></Button>
              </View>
            </View>
          </View>
        );
      }
}

