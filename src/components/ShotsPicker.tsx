import React, { Component } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';

interface Props {
  defaultSelection?: string;
  callBack: (key: string, value: string) => void;
}

interface State {
  shots: string;
}

export default class ShotsPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { shots: this.props.defaultSelection ?? '' };
  }

  render() {
    return (
      <View>
        <Text style={styles.label}>Shots</Text>
        <Picker
          selectedValue={this.state.shots}
          style={{ flex: 1 }}
          onValueChange={(itemValue) => {
            this.setState({ shots: String(itemValue) });
            this.props.callBack('shots', String(itemValue));
          }}
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <Picker.Item key={n} label={String(n)} value={String(n)} />
          ))}
        </Picker>
      </View>
    );
  }
}
