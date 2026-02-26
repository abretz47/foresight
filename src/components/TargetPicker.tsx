import React, { Component } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';

interface Props {
  defaultSelection?: string;
  callBack: (key: string, value: string) => void;
}

interface State {
  target: string;
}

export default class TargetPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { target: this.props.defaultSelection ?? '' };
  }

  render() {
    return (
      <View>
        <Text style={styles.label}>Target</Text>
        <Picker
          selectedValue={this.state.target}
          style={{ flex: 1 }}
          onValueChange={(itemValue) => {
            this.setState({ target: String(itemValue) });
            this.props.callBack('target', String(itemValue));
          }}
        >
          {Array.from({ length: 11 }, (_, i) => (i + 10) * 10).map((n) => (
            <Picker.Item key={n} label={String(n)} value={String(n)} />
          ))}
        </Picker>
      </View>
    );
  }
}
