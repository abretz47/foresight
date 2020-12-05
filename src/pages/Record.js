import React, {Component} from 'react';
import {TouchableOpacity,TouchableHighlight, Alert, StyleSheet, Text, View, Button, Dimensions, Image } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';
import Modal from 'react-native-modal';
import { styles } from '../styles/styles';
import * as DB from '../data/db';

export default class Record extends Component{
  constructor(props){
    super(props);
    const { navigation } = this.props;
    this.state = {
      screenWidth: Math.round(Dimensions.get('window').width),
      screenHeight: Math.round(Dimensions.get('window').height),
      shotName : navigation.getParam('shotName', "--"),
      targetDistance: navigation.getParam('targetDistance',"--"),
      targetRadius: navigation.getParam('targetRadius',"--"),
      missRadius: navigation.getParam('missRadius',"--"),
      targetRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * (navigation.getParam('targetRadius',"--")/navigation.getParam('missRadius',"--")) * .7)/2,
      missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * .7)/2,
      modalVisible: false,
      clickedFrom : "",
      shotDistance : "",
      shotAccuracy: "",
      shotX: "",
      shotY: "",
      data : [],
      shotId : navigation.getParam('id', "--"),
      calledFrom : navigation.getParam('calledFrom', "Default")
    }
  }
  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('didFocus', () => {
      // The screen is focused
      this.loadData(this.state.shotId);
      });
  }
  componentWillUnmount() {
    // Remove the event listener
    this.focusListener.remove();
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
          <View style={styles.column}>
            <TouchableOpacity
                style={ this.fieldOfPlay()}
                onPress={(evt) => {
                  if(this.state.calledFrom == "Record"){
                    this.setState({shotDistance: (this.state.targetDistance - ((evt.nativeEvent.locationY - this.state.missRadiusPx)*this.state.missRadius)/this.state.missRadiusPx).toFixed(0),
                      shotAccuracy: (((evt.nativeEvent.locationX - this.state.missRadiusPx)*this.state.missRadius)/this.state.missRadiusPx).toFixed(0),
                      shotX : evt.nativeEvent.locationX,
                      shotY : evt.nativeEvent.locationY,
                      clickedFrom : "miss",
                      modalVisible:true});
                  }}}
            >
              <View style={this.missCircle()}>
                <View style={this.targetCircle()}>
                </View>
              </View>


            </TouchableOpacity>
          </View>
            {/*<View style={styles.touchableContainer}>*/}
            {/*  */}
            {/*</View>*/}
            <Modal isVisible={this.state.modalVisible}>
                <View style={styles.modalContent}>
                  <View style={styles.row}>
                    <View style={styles.column}>
                      <Text style={styles.smallLabel}>Distance</Text>
                      <Text>{this.state.shotDistance}</Text>
                    </View>
                    <View style={styles.column}>
                      <Text style={styles.smallLabel}>Accuracy</Text>
                      <Text>{this.convertShotAccuracy(this.state.shotAccuracy)}</Text>
                    </View>
                  </View>
                  <View style={styles.buttonRow}>
                    <View style={styles.buttonDanger}>
                      <Button style={styles.buttonDanger} color="black" title="Cancel" onPress={() => {this.setState({modalVisible:false})}}></Button>
                    </View>
                    <View style={styles.buttonSuccess}>
                      <Button title="Ok!" color="black" onPress={() => {
                        DB.saveDataPoint(this.props.navigation.getParam("user","abretz"),{
                          id : this.state.shotId,
                          shotX : this.state.shotX,
                          shotY : this.state.shotY,
                          clickedFrom : this.state.clickedFrom,
                          screenHeight : this.state.screenHeight,
                          screenWidth : this.state.screenWidth,
                        });
                        this.setState({modalVisible:false});}} >
                        </Button>
                    </View>
                  </View>
                </View>
              </Modal>
        </View>
      );
  }

  missCircle() {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      backgroundColor:'white',
      width: this.state.missRadiusPx * 2,
      height: this.state.missRadiusPx * 2,
      borderRadius: this.state.missRadiusPx,
      justifyContent: 'center',
      alignItems: 'center'
    }
  }
  targetCircle = () => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      backgroundColor:'red',
      width: this.state.targetRadiusPx * 2,
      height: this.state.targetRadiusPx * 2,
      borderRadius: this.state.targetRadiusPx
    }
  }
  dataStyle = (left,top) => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      backgroundColor:'black',
      width: 10,
      height: 10,
      position: "absolute",
      left: left,
      top: top,
      borderRadius: 5,
      zIndex: "1000"
    }
  }
  fieldOfPlay = () => {
    return {
      padding: this.state.missRadiusPx,
      backgroundColor:'#2BBB32',
      height: this.state.screenHeight - 200,
      // borderRadius: this.state.missRadiusPx,
      alignItems:'center',
      justifyContent:'center',
    }
  }
  missButtonContainer = () =>{
    return {
      borderRadius: this.state.missRadiusPx
    }
  }
  convertShotAccuracy = (number) => {
    var absVal = Math.abs(number);
    if(number <= 0){
      return String(absVal) + " L";
    }
    else{
      return String(absVal) + " R";
    }
  }
  loadData = (id) => {
    DB.getShotData(this.props.navigation.getParam("user","abretz"),id,(data) => {
      this.setState({data:data})
    })
  }
}