import React, {Component} from 'react';
import { View,Picker, Text } from 'react-native';

import {styles} from '../styles/styles.js';


export default class TargetPicker extends Component{
    constructor(props){
        super(props);//research what this does
        this.state={target:this.props.defaultSelection};
    }
    render(){
        return(
            <View>
                <Text style={styles.label}>Target</Text>
                <Picker 
                    selectedValue={this.state.target}
                    style={{flex: 1}}
                    onValueChange={(itemValue, itemIndex) =>{
                        this.setState({target: itemValue});
                        this.props.callBack("target",itemValue);
                    }
                    }>
                    <Picker.Item label="100" value="100"/>
                    <Picker.Item label="110" value="110"/>
                    <Picker.Item label="120" value="120"/>
                    <Picker.Item label="130" value="130"/>
                    <Picker.Item label="140" value="140"/>
                    <Picker.Item label="150" value="150"/>
                    <Picker.Item label="160" value="160"/>
                    <Picker.Item label="170" value="170"/>
                    <Picker.Item label="180" value="180"/>
                    <Picker.Item label="190" value="190"/>
                    <Picker.Item label="200" value="200"/>
                </Picker>
            </View>
        )
    }
}