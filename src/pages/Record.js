import React, {Component} from 'react';
import {TouchableOpacity,TouchableHighlight, Alert, StyleSheet, Text, View, Button, Dimensions } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';
import Modal from 'react-native-modal';
import { styles } from '../styles/styles';

export default class Record extends Component{
  constructor(props){
    super(props);
    const { navigation } = this.props;
    this.state = {
      screenWidth: Math.round(Dimensions.get('window').width),
      screenHeight: Math.round(Dimensions.get('window').width),
      shotName : navigation.getParam('shotName', "--"),
      targetDistance: navigation.getParam('targetDistance',"--"),
      targetRadius: navigation.getParam('targetRadius',"--"),
      missRadius: navigation.getParam('missRadius',"--"),
      targetRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * (navigation.getParam('targetRadius',"--")/navigation.getParam('missRadius',"--")) * .7)/2,
      missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * .7)/2,
      modalVisible: false
    }
  }
  targetStyle = () => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      width: this.state.targetRadiusPx * 2,
      height: this.state.targetRadiusPx * 2,
      backgroundColor:'red',
      borderRadius: this.state.targetRadiusPx,
    }
  }  
  missStyle = () => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      width: this.state.missRadiusPx * 2,
      height: this.state.missRadiusPx * 2,
      backgroundColor:'#FFFFFF',
      borderRadius: this.state.missRadiusPx,
    }
  }
  render(){
      return(
        <View style={styles.template}>
          <View style={styles.row}>
            <View style={styles.column}>
                <Text style={styles.smallLabel}>Shot</Text>
                <Text>{this.state.shotName}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Distance</Text>
                <Text>{this.state.targetDistance}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Target Radius</Text>
                <Text>{this.state.targetRadius}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Miss Radius</Text>
                <Text>{this.state.missRadius}</Text>
              </View>
            </View>
            <View style={styles.touchableContainer}>
              <View style={styles.row}>
                <TouchableOpacity
                  style={ this.missStyle()}
                  onPress={(evt) => {console.log(evt.nativeEvent.pageY)}}
                >
                <View style={styles.touchableContainer}>
                  <View style={styles.row}>
                    <TouchableOpacity onLayout={(evt) => { console.log("target layout: ", evt)}}
                      style={this.targetStyle()}
                      onPress={(evt) => {
                          var xCoord = evt.nativeEvent.locationX;
                          var yCoord = evt.nativeEvent.locationY;
                          console.log("shotY: ", evt.nativeEvent.locationY);
                          console.log("Distance: ", this.state.targetDistance - ((evt.nativeEvent.locationY - this.state.targetRadiusPx)*this.state.targetRadius)/this.state.targetRadiusPx);
                          console.log("Accuracy: ", ((evt.nativeEvent.locationX - this.state.targetRadiusPx)*this.state.targetRadius)/this.state.targetRadiusPx);
                          this.setState({modalVisible:true});
                        }}
                    >
                    </TouchableOpacity>
                  </View>
                </View>
                </TouchableOpacity>
              </View>
            </View>
            <Modal isVisible={this.state.modalVisible}>
                <View style={styles.modalContent}>
                  <Text>Hello</Text>
                  <Button style={styles.modalButton} title="Close" onPress={() => {this.setState({modalVisible:false})}}></Button>
                </View>
              </Modal>
        </View>
      );
  }
}